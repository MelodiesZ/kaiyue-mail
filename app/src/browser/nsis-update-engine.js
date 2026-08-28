const { EventEmitter } = require('events');
const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { PassThrough, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const kaiyueConfig = require('../../kaiyue-config.json');
const internalTrustConfig = require('../../internal-trust.json');

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const INTERNAL_ROOT_CERTIFICATE = internalTrustConfig.certificateFileName;
const INTERNAL_ROOT_INSTALL_SCRIPT = internalTrustConfig.installScriptFileName;
const INTERNAL_ROOT_SHA256 = internalTrustConfig.certificateSha256.toUpperCase();

class NonRetryableUpdateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NonRetryableUpdateError';
    this.code = code;
    this.retryable = false;
  }
}

function compareVersions(left, right) {
  const leftMatch = `${left || ''}`.match(STABLE_VERSION);
  const rightMatch = `${right || ''}`.match(STABLE_VERSION);
  if (!leftMatch || !rightMatch) {
    throw new Error('Update versions must use stable semantic versioning.');
  }
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function normalizeInstalledVersion(value) {
  const match = `${value || ''}`.match(/^(\d+\.\d+\.\d+)(?:[-+].+)?$/);
  if (!match) throw new Error('Installed update version is invalid.');
  return match[1];
}

async function readJsonStream(stream) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Update manifest is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireHttps(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  return parsed;
}

function normalizeInstallerURLs(version, primaryURL, fallbackURLs = []) {
  if (!Array.isArray(fallbackURLs) || fallbackURLs.length > 3) {
    throw new Error('Update manifest fallback URLs are invalid.');
  }
  const expectedName = `KaiyueMail-win32-x64-${version}.exe`;
  const seen = new Set();
  const urls = [primaryURL, ...fallbackURLs].map((value, index) => {
    const installerURL = requireHttps(
      value,
      index === 0 ? 'Update installer URL' : 'Update fallback URL'
    );
    if (path.basename(installerURL.pathname) !== expectedName) {
      throw new Error(`Update installer must be named ${expectedName}.`);
    }
    if (seen.has(installerURL.href)) {
      throw new Error('Update manifest contains a duplicate installer URL.');
    }
    seen.add(installerURL.href);
    return installerURL.href;
  });
  return urls;
}

function normalizeManifest(value) {
  if (!value || value.schemaVersion !== 1) {
    throw new Error('The update manifest schema is unsupported.');
  }
  compareVersions(value.version, value.version);
  const installerURLs = normalizeInstallerURLs(value.version, value.url, value.fallbackUrls || []);
  if (!/^[a-f\d]{64}$/i.test(`${value.sha256 || ''}`)) {
    throw new Error('Update manifest SHA-256 is invalid.');
  }
  if (!Number.isSafeInteger(value.size) || value.size <= 0 || value.size > 1024 * 1024 * 1024) {
    throw new Error('Update manifest size is invalid.');
  }
  return {
    version: value.version,
    url: installerURLs[0],
    fallbackUrls: installerURLs.slice(1),
    sha256: value.sha256.toLowerCase(),
    size: value.size,
    notes: typeof value.notes === 'string' ? value.notes : '',
  };
}

function requestHttpsStream(requestURL, redirectsRemaining = 5) {
  const parsed = requireHttps(requestURL, 'Update URL');
  return new Promise((resolve, reject) => {
    const request = https.get(
      parsed,
      {
        headers: {
          Accept: 'application/octet-stream, application/json',
          'User-Agent': 'Kaiyue-Mail-Updater',
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirectsRemaining <= 0) {
            reject(new Error('Update server returned too many redirects.'));
            return;
          }
          const redirectedURL = new URL(location, parsed).href;
          requestHttpsStream(redirectedURL, redirectsRemaining - 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Update server returned status ${status}.`));
          return;
        }
        resolve(response);
      }
    );
    request.setTimeout(30000, () => request.destroy(new Error('Update request timed out.')));
    request.on('error', reject);
  });
}

function createElectronNetRequestStream(electronNet, options = {}) {
  if (!electronNet || typeof electronNet.request !== 'function') {
    throw new Error('Electron network adapter is unavailable.');
  }
  const timeoutMs = options.timeoutMs || 30000;
  const maxRedirects = options.maxRedirects ?? 5;

  return function requestElectronNetStream(requestURL) {
    const parsed = requireHttps(requestURL, 'Update URL');
    return new Promise((resolve, reject) => {
      const output = new PassThrough();
      let request;
      let responseStarted = false;
      let terminal = false;
      let aborting = false;
      let redirects = 0;
      let inactivityTimer;

      const clearInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = undefined;
      };
      const fail = (error) => {
        if (terminal) return;
        terminal = true;
        clearInactivityTimer();
        if (!aborting && request) {
          aborting = true;
          request.abort();
        }
        if (responseStarted) output.destroy(error);
        else reject(error);
      };
      const armInactivityTimer = () => {
        clearInactivityTimer();
        inactivityTimer = setTimeout(() => fail(new Error('Update request timed out.')), timeoutMs);
        if (typeof inactivityTimer.unref === 'function') inactivityTimer.unref();
      };

      output.on('close', () => {
        if (!terminal) fail(new Error('Update response stream was closed.'));
      });

      request = electronNet.request({
        method: 'GET',
        url: parsed.href,
        redirect: 'manual',
      });
      request.setHeader('Accept', 'application/octet-stream, application/json');
      request.setHeader('User-Agent', 'Kaiyue-Mail-Updater');
      request.on('redirect', (_statusCode, _method, redirectURL) => {
        redirects += 1;
        if (redirects > maxRedirects) {
          fail(new Error('Update server returned too many redirects.'));
          return;
        }
        try {
          requireHttps(redirectURL, 'Update redirect URL');
        } catch (error) {
          fail(error);
          return;
        }
        armInactivityTimer();
        try {
          request.followRedirect();
        } catch (error) {
          fail(error);
        }
      });
      request.on('response', (response) => {
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          fail(new Error(`Update server returned status ${status}.`));
          return;
        }

        responseStarted = true;
        resolve(output);
        armInactivityTimer();
        response.on('data', (chunk) => {
          if (terminal) return;
          armInactivityTimer();
          output.write(Buffer.from(chunk));
        });
        response.on('end', () => {
          if (terminal) return;
          terminal = true;
          clearInactivityTimer();
          output.end();
        });
        response.on('aborted', () => fail(new Error('Update response was interrupted.')));
        response.on('error', fail);
      });
      request.on('abort', () => {
        if (!aborting) fail(new Error('Update request was aborted.'));
      });
      request.on('error', fail);
      armInactivityTimer();
      request.end();
    });
  };
}

const defaultAllowedPublishers = [
  kaiyueConfig.brand.company,
  kaiyueConfig.brand.companyEnglish,
].filter(Boolean);

function normalizeDistinguishedNameValue(value) {
  let normalized = `${value || ''}`.replace(/""/g, '"').trim();
  const outerQuotePairs = [
    ['“', '”'],
    ['‘', '’'],
  ];
  const matchingPair = outerQuotePairs.find(
    ([opening, closing]) => normalized.startsWith(opening) && normalized.endsWith(closing)
  );
  if (matchingPair) normalized = normalized.slice(1, -1).trim();
  return normalized.toLowerCase();
}

function hasAllowedAuthenticodePublisher(signature, allowedPublishers) {
  if (!signature) return false;
  const subjectValues = [];
  const subject = `${signature.subject || ''}`;
  const fieldPattern =
    /(?:^|,\s*)[a-z][a-z\d.]*=(?:"((?:[^"]|"")*)"|(.+?))(?=,\s*[a-z][a-z\d.]*=|$)/gi;
  let match;
  while ((match = fieldPattern.exec(subject))) {
    subjectValues.push(normalizeDistinguishedNameValue(match[1] || match[2] || ''));
  }
  const trustedPublishers = allowedPublishers
    .map((publisher) => `${publisher || ''}`.trim().toLowerCase())
    .filter(Boolean);
  return trustedPublishers.some((publisher) => subjectValues.includes(publisher));
}

function isTrustedAuthenticodeSignature(signature, allowedPublishers) {
  return (
    signature &&
    `${signature.status || ''}`.toLowerCase() === 'valid' &&
    hasAllowedAuthenticodePublisher(signature, allowedPublishers)
  );
}

function windowsPowerShellPath() {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  return path.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
}

function inspectAuthenticode(installerPath) {
  const script = [
    '$signature = Get-AuthenticodeSignature -LiteralPath $args[0]',
    '$subject = if ($null -ne $signature.SignerCertificate) { [string]$signature.SignerCertificate.Subject } else { "" }',
    '$result = [PSCustomObject]@{ status = [string]$signature.Status; statusMessage = [string]$signature.StatusMessage; subject = $subject }',
    '$result | ConvertTo-Json -Compress',
  ].join('; ');
  return new Promise((resolve) => {
    childProcess.execFile(
      windowsPowerShellPath(),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'RemoteSigned',
        '-Command',
        script,
        installerPath,
      ],
      { windowsHide: true, timeout: 30000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve(null);
        }
      }
    );
  });
}

function installInternalRoot(resourcesPath = process.resourcesPath) {
  if (!resourcesPath) return Promise.resolve(false);
  const certificatePath = path.join(resourcesPath, INTERNAL_ROOT_CERTIFICATE);
  const installScriptPath = path.join(resourcesPath, INTERNAL_ROOT_INSTALL_SCRIPT);
  if (!fs.existsSync(certificatePath) || !fs.existsSync(installScriptPath)) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    childProcess.execFile(
      windowsPowerShellPath(),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        installScriptPath,
        '-CertificatePath',
        certificatePath,
        '-ExpectedFileSha256',
        INTERNAL_ROOT_SHA256,
        '-NonInteractive',
      ],
      { windowsHide: true, timeout: 30000 },
      (error) => resolve(!error)
    );
  });
}

function canBootstrapInternalTrust(signature, allowedPublishers) {
  const status = `${signature?.status || ''}`.toLowerCase();
  return (
    (status === 'unknownerror' || status === 'nottrusted') &&
    hasAllowedAuthenticodePublisher(signature, allowedPublishers)
  );
}

async function verifyAuthenticode(
  installerPath,
  allowedPublishers = defaultAllowedPublishers,
  dependencies = {}
) {
  const inspect = dependencies.inspectAuthenticode || inspectAuthenticode;
  const installRoot = dependencies.installInternalRoot || installInternalRoot;
  const signature = await inspect(installerPath);
  if (isTrustedAuthenticodeSignature(signature, allowedPublishers)) return true;
  if (!canBootstrapInternalTrust(signature, allowedPublishers)) return false;
  if (!(await installRoot())) return false;
  return isTrustedAuthenticodeSignature(await inspect(installerPath), allowedPublishers);
}

function spawnDetached(executable, args) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function sha256FileSync(filePath) {
  const hash = crypto.createHash('sha256');
  const file = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(file);
  }
  return hash.digest('hex');
}

class NsisUpdateEngine extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.requestStream = dependencies.requestStream || requestHttpsStream;
    this.verifyAuthenticode = dependencies.verifyAuthenticode || verifyAuthenticode;
    this.tempRoot = dependencies.tempRoot || os.tmpdir();
    this.spawnDetached = dependencies.spawnDetached || spawnDetached;
    this.allowedPublishers = dependencies.allowedPublishers || defaultAllowedPublishers;
    this.processId = dependencies.processId || process.pid;
  }

  async check(feedURL, currentVersion) {
    if (!this.requestStream) throw new Error('NSIS updater request adapter is unavailable.');
    const feedURLs = Array.isArray(feedURL) ? feedURL : [feedURL];
    if (!feedURLs.length || feedURLs.length > 4) {
      throw new Error('Update feed URLs are invalid.');
    }
    let lastError;
    for (let index = 0; index < feedURLs.length; index += 1) {
      const currentFeedURL = requireHttps(feedURLs[index], 'Update feed URL').href;
      try {
        const manifest = normalizeManifest(
          await readJsonStream(await this.requestStream(currentFeedURL))
        );
        if (compareVersions(manifest.version, normalizeInstalledVersion(currentVersion)) <= 0) {
          return null;
        }
        this.emit('update-available', manifest);
        return manifest;
      } catch (error) {
        lastError = error;
        const nextURL = feedURLs[index + 1];
        if (nextURL) {
          this.emit('manifest-retry', {
            failedURL: currentFeedURL,
            nextURL,
            error: error.message,
          });
        }
      }
    }
    throw lastError;
  }

  async download(manifest) {
    if (!manifest || typeof manifest.url !== 'string') {
      throw new Error('A checked NSIS update manifest is required.');
    }

    const installerURLs = normalizeInstallerURLs(
      manifest.version,
      manifest.url,
      manifest.fallbackUrls || []
    );
    let lastError;
    for (let index = 0; index < installerURLs.length; index += 1) {
      try {
        return await this.downloadFromURL(manifest, installerURLs[index]);
      } catch (error) {
        lastError = error;
        // Use fallback hosts for connection failures and interrupted transfers.
        // A byte-complete integrity or local trust failure is non-retryable:
        // downloading the same 200 MB installer again hides a publishing issue
        // and wastes bandwidth instead of giving the user an actionable error.
        if (error && error.retryable === false) throw error;
        const nextURL = installerURLs[index + 1];
        if (nextURL) {
          this.emit('download-retry', {
            failedURL: installerURLs[index],
            nextURL,
            error: error.message,
          });
        }
      }
    }
    throw lastError;
  }

  async downloadFromURL(manifest, downloadURL) {
    const updateDirectory = fs.mkdtempSync(path.join(this.tempRoot, 'KaiyueMailUpdate-'));
    const partialPath = path.join(
      updateDirectory,
      `${path.basename(new URL(downloadURL).pathname)}.part`
    );
    const installerPath = partialPath.slice(0, -5);
    const hash = crypto.createHash('sha256');
    let size = 0;
    let lastReportedPercent = -1;
    let lastReportedBytes = -1;
    let lastReportedAt = 0;
    const reportProgress = (force = false) => {
      const percent = Math.min(100, Math.floor((size / manifest.size) * 100));
      const now = Date.now();
      const receivedFirstBytes = lastReportedBytes === 0 && size > 0;
      const advancedEnough = size - lastReportedBytes >= 256 * 1024;
      const waitedLongEnough = size > lastReportedBytes && now - lastReportedAt >= 250;
      if (
        !force &&
        percent === lastReportedPercent &&
        !receivedFirstBytes &&
        !advancedEnough &&
        !waitedLongEnough
      ) {
        return;
      }
      lastReportedPercent = percent;
      lastReportedBytes = size;
      lastReportedAt = now;
      this.emit('download-progress', {
        percent,
        transferred: size,
        total: manifest.size,
      });
    };
    const verifier = new Transform({
      transform(chunk, _encoding, callback) {
        size += chunk.length;
        if (size > manifest.size) {
          callback(
            new NonRetryableUpdateError(
              'ERR_UPDATE_SIZE_MISMATCH',
              '更新镜像返回的安装包大小异常。为避免重复下载，已停止更新；请稍后重试。'
            )
          );
          return;
        }
        hash.update(chunk);
        reportProgress();
        callback(null, chunk);
      },
    });

    try {
      reportProgress(true);
      await pipeline(
        await this.requestStream(downloadURL),
        verifier,
        fs.createWriteStream(partialPath, { flags: 'wx' })
      );
      const digest = hash.digest('hex');
      if (size !== manifest.size)
        throw new Error('Downloaded update size does not match manifest.');
      if (digest !== manifest.sha256) {
        throw new NonRetryableUpdateError(
          'ERR_UPDATE_INTEGRITY_MISMATCH',
          '更新镜像已完整下载，但安装包完整性校验失败。为避免重复下载，已停止更新；请稍后重试。'
        );
      }
      fs.renameSync(partialPath, installerPath);
      if (
        !this.verifyAuthenticode ||
        !(await this.verifyAuthenticode(installerPath, this.allowedPublishers))
      ) {
        throw new NonRetryableUpdateError(
          'ERR_UPDATE_SIGNATURE_NOT_TRUSTED',
          '更新包已下载并通过完整性校验，但 Windows 无法信任其代码签名。请先安装凯越邮箱内部信任证书，然后重试更新。'
        );
      }
      return {
        filePath: installerPath,
        version: manifest.version,
        notes: manifest.notes,
        sha256: manifest.sha256,
        size: manifest.size,
      };
    } catch (error) {
      fs.rmSync(updateDirectory, { recursive: true, force: true });
      if (error && error.retryable !== false && size >= manifest.size) {
        const completedDownloadError = new NonRetryableUpdateError(
          'ERR_UPDATE_COMPLETED_VALIDATION_FAILED',
          '更新镜像已下载完成，但最终校验未能完成。为避免重复下载，已停止更新；请稍后重试。'
        );
        completedDownloadError.cause = error;
        throw completedDownloadError;
      }
      throw error;
    }
  }

  async prepare(feedURL, currentVersion) {
    const manifest = await this.check(feedURL, currentVersion);
    return manifest ? this.download(manifest) : null;
  }

  async install(update) {
    if (!update || typeof update.filePath !== 'string') {
      throw new Error('A prepared NSIS update is required.');
    }
    if (
      !fs.existsSync(update.filePath) ||
      fs.statSync(update.filePath).size !== update.size ||
      sha256FileSync(update.filePath) !== update.sha256
    ) {
      throw new Error('The prepared NSIS update changed after verification.');
    }
    if (!this.spawnDetached) throw new Error('NSIS updater launch adapter is unavailable.');
    await this.spawnDetached(update.filePath, ['/S', '/UPDATE', `/PARENT_PID=${this.processId}`]);
  }
}

module.exports = {
  NsisUpdateEngine,
  compareVersions,
  createElectronNetRequestStream,
  normalizeInstalledVersion,
  normalizeManifest,
  requestHttpsStream,
  verifyAuthenticode,
  isTrustedAuthenticodeSignature,
  NonRetryableUpdateError,
};
