const { EventEmitter } = require('events');
const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const kaiyueConfig = require('../../kaiyue-config.json');

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

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

function normalizeManifest(value) {
  if (!value || value.schemaVersion !== 1) {
    throw new Error('The update manifest schema is unsupported.');
  }
  compareVersions(value.version, value.version);
  const installerURL = requireHttps(value.url, 'Update installer URL');
  const expectedName = `KaiyueMail-win32-x64-${value.version}.exe`;
  if (path.basename(installerURL.pathname) !== expectedName) {
    throw new Error(`Update installer must be named ${expectedName}.`);
  }
  if (!/^[a-f\d]{64}$/i.test(`${value.sha256 || ''}`)) {
    throw new Error('Update manifest SHA-256 is invalid.');
  }
  if (!Number.isSafeInteger(value.size) || value.size <= 0 || value.size > 1024 * 1024 * 1024) {
    throw new Error('Update manifest size is invalid.');
  }
  return {
    version: value.version,
    url: installerURL.href,
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

const defaultAllowedPublishers = [
  kaiyueConfig.brand.company,
  kaiyueConfig.brand.companyEnglish,
].filter(Boolean);

function isTrustedAuthenticodeSignature(signature, allowedPublishers) {
  if (!signature || `${signature.status || ''}`.toLowerCase() !== 'valid') return false;
  const subjectValues = [];
  const subject = `${signature.subject || ''}`;
  const fieldPattern =
    /(?:^|,\s*)[a-z][a-z\d.]*=(?:"((?:[^"]|"")*)"|(.+?))(?=,\s*[a-z][a-z\d.]*=|$)/gi;
  let match;
  while ((match = fieldPattern.exec(subject))) {
    subjectValues.push((match[1] || match[2] || '').replace(/""/g, '"').trim().toLowerCase());
  }
  const trustedPublishers = allowedPublishers
    .map((publisher) => `${publisher || ''}`.trim().toLowerCase())
    .filter(Boolean);
  return trustedPublishers.some((publisher) => subjectValues.includes(publisher));
}

function verifyAuthenticode(installerPath, allowedPublishers = defaultAllowedPublishers) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const script = [
    '$signature = Get-AuthenticodeSignature -LiteralPath $args[0]',
    '$result = [PSCustomObject]@{ status = [string]$signature.Status; subject = [string]$signature.SignerCertificate.Subject }',
    '$result | ConvertTo-Json -Compress',
  ].join('; ');
  return new Promise((resolve) => {
    childProcess.execFile(
      powershell,
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
          resolve(false);
          return;
        }
        try {
          resolve(isTrustedAuthenticodeSignature(JSON.parse(stdout), allowedPublishers));
        } catch {
          resolve(false);
        }
      }
    );
  });
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
    requireHttps(feedURL, 'Update feed URL');
    const manifest = normalizeManifest(await readJsonStream(await this.requestStream(feedURL)));
    if (compareVersions(manifest.version, normalizeInstalledVersion(currentVersion)) <= 0) {
      return null;
    }
    this.emit('update-available', manifest);
    return manifest;
  }

  async download(manifest) {
    if (!manifest || typeof manifest.url !== 'string') {
      throw new Error('A checked NSIS update manifest is required.');
    }

    const updateDirectory = fs.mkdtempSync(path.join(this.tempRoot, 'KaiyueMailUpdate-'));
    const partialPath = path.join(
      updateDirectory,
      `${path.basename(new URL(manifest.url).pathname)}.part`
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
          callback(new Error('Downloaded update exceeds the size declared by the manifest.'));
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
        await this.requestStream(manifest.url),
        verifier,
        fs.createWriteStream(partialPath, { flags: 'wx' })
      );
      const digest = hash.digest('hex');
      if (size !== manifest.size)
        throw new Error('Downloaded update size does not match manifest.');
      if (digest !== manifest.sha256) {
        throw new Error('Downloaded update SHA-256 does not match manifest.');
      }
      fs.renameSync(partialPath, installerPath);
      if (
        !this.verifyAuthenticode ||
        !(await this.verifyAuthenticode(installerPath, this.allowedPublishers))
      ) {
        throw new Error('Downloaded update does not have a valid trusted code signature.');
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
  normalizeInstalledVersion,
  normalizeManifest,
  requestHttpsStream,
  verifyAuthenticode,
  isTrustedAuthenticodeSignature,
};
