const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  NsisUpdateEngine,
  createElectronNetRequestStream,
  isTrustedAuthenticodeSignature,
  verifyAuthenticode,
} = require('../app/src/browser/nsis-update-engine');

function jsonStream(value) {
  return Readable.from([Buffer.from(JSON.stringify(value))]);
}

test('uses Electron net for system-aware update downloads and follows secure redirects', async () => {
  const requests = [];
  const fakeNet = {
    request(options) {
      const request = new EventEmitter();
      request.options = options;
      request.headers = {};
      request.redirectFollowed = false;
      request.setHeader = (name, value) => {
        request.headers[name] = value;
      };
      request.followRedirect = () => {
        request.redirectFollowed = true;
      };
      request.abort = () => {};
      request.end = () => {
        queueMicrotask(() => {
          request.emit(
            'redirect',
            302,
            'GET',
            'https://release-assets.githubusercontent.com/KaiyueMail-win32-x64-1.0.6.exe',
            {}
          );
          assert.equal(request.redirectFollowed, true);
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = { 'content-length': '12' };
          request.emit('response', response);
          queueMicrotask(() => {
            response.emit('data', Buffer.from('kaiyue-'));
            response.emit('data', Buffer.from('update'));
            response.emit('end');
          });
        });
      };
      requests.push(request);
      return request;
    },
  };

  const requestStream = createElectronNetRequestStream(fakeNet);
  const stream = await requestStream(
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.6/KaiyueMail-win32-x64-1.0.6.exe'
  );
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  assert.equal(Buffer.concat(chunks).toString(), 'kaiyue-update');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, 'manual');
  assert.equal(requests[0].headers.Accept, 'application/octet-stream, application/json');
  assert.equal(requests[0].headers['User-Agent'], 'Kaiyue-Mail-Updater');
});

test('Electron net updater refuses redirects that leave HTTPS', async () => {
  const fakeNet = {
    request() {
      const request = new EventEmitter();
      request.setHeader = () => {};
      request.followRedirect = () => assert.fail('insecure redirect must not be followed');
      request.abort = () => {};
      request.end = () => {
        queueMicrotask(() =>
          request.emit('redirect', 302, 'GET', 'http://downloads.example.test/update.exe', {})
        );
      };
      return request;
    },
  };

  const requestStream = createElectronNetRequestStream(fakeNet);
  await assert.rejects(
    requestStream('https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/update.exe'),
    /must use HTTPS/
  );
});

test('does not download an installer when the published version is not newer', async () => {
  const requested = [];
  const engine = new NsisUpdateEngine({
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.1',
        url: 'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.1/KaiyueMail-win32-x64-1.0.1.exe',
        sha256: 'a'.repeat(64),
        size: 10,
      });
    },
    verifyAuthenticode: async () => true,
  });

  const result = await engine.prepare(
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    '1.0.1-deadbee'
  );

  assert.equal(result, null);
  assert.equal(requested.length, 1);
});

test('prepares a newer installer only after hash, size, and signature validation', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installer = Buffer.from('signed-kaiyue-installer');
  const installerURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.2/KaiyueMail-win32-x64-1.0.2.exe';
  const requested = [];
  const signatures = [];
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      if (requestUrl === installerURL) return Readable.from([installer]);
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.2',
        url: installerURL,
        sha256: crypto.createHash('sha256').update(installer).digest('hex'),
        size: installer.length,
        notes: '企业邮箱安全更新',
      });
    },
    verifyAuthenticode: async (installerPath) => {
      signatures.push(installerPath);
      return true;
    },
  });

  const result = await engine.prepare(
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    '1.0.1'
  );

  assert.equal(result.version, '1.0.2');
  assert.equal(result.notes, '企业邮箱安全更新');
  assert.deepEqual(fs.readFileSync(result.filePath), installer);
  assert.deepEqual(requested, [
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    installerURL,
  ]);
  assert.deepEqual(signatures, [result.filePath]);
});

test('falls back to GitHub when the primary update mirror cannot download the installer', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installer = Buffer.from('signed-kaiyue-installer');
  const mirrorURL = 'https://download.kaiyue-ai.com/v1.0.6/KaiyueMail-win32-x64-1.0.6.exe';
  const githubURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.6/KaiyueMail-win32-x64-1.0.6.exe';
  const requested = [];
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      if (requestUrl === mirrorURL) throw new Error('mirror unavailable');
      if (requestUrl === githubURL) return Readable.from([installer]);
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.6',
        url: mirrorURL,
        fallbackUrls: [githubURL],
        sha256: crypto.createHash('sha256').update(installer).digest('hex'),
        size: installer.length,
      });
    },
    verifyAuthenticode: async () => true,
  });

  const result = await engine.prepare(
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    '1.0.5'
  );

  assert.deepEqual(fs.readFileSync(result.filePath), installer);
  assert.deepEqual(requested, [
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    mirrorURL,
    githubURL,
  ]);
});

test('does not redownload a byte-identical fallback after signature validation fails', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installer = Buffer.from('downloaded-completely-but-signature-is-not-trusted');
  const mirrorURL = 'https://download.kaiyue-ai.com/v1.0.8/KaiyueMail-win32-x64-1.0.8.exe';
  const githubURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.8/KaiyueMail-win32-x64-1.0.8.exe';
  const requested = [];
  const progress = [];
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      return Readable.from([installer]);
    },
    verifyAuthenticode: async () => false,
  });
  engine.on('download-progress', (detail) => progress.push(detail));

  await assert.rejects(
    engine.download({
      version: '1.0.8',
      url: mirrorURL,
      fallbackUrls: [githubURL],
      sha256: crypto.createHash('sha256').update(installer).digest('hex'),
      size: installer.length,
      notes: '',
    }),
    (error) => {
      assert.equal(error.code, 'ERR_UPDATE_SIGNATURE_NOT_TRUSTED');
      assert.match(error.message, /内部信任证书/);
      return true;
    }
  );

  assert.deepEqual(requested, [mirrorURL]);
  assert.equal(progress.filter((detail) => detail.percent === 100).length, 1);
});

test('does not redownload a byte-complete mirror response when its digest is corrupted', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const expectedInstaller = Buffer.from('signed-kaiyue-installer');
  const corruptedInstaller = Buffer.from(expectedInstaller);
  corruptedInstaller[0] ^= 0xff;
  const mirrorURL = 'https://download.kaiyue-ai.com/v1.0.8/KaiyueMail-win32-x64-1.0.8.exe';
  const githubURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.8/KaiyueMail-win32-x64-1.0.8.exe';
  const requested = [];
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      return Readable.from([requestUrl === mirrorURL ? corruptedInstaller : expectedInstaller]);
    },
    verifyAuthenticode: async () => true,
  });

  await assert.rejects(
    engine.download({
      version: '1.0.8',
      url: mirrorURL,
      fallbackUrls: [githubURL],
      sha256: crypto.createHash('sha256').update(expectedInstaller).digest('hex'),
      size: expectedInstaller.length,
      notes: '',
    }),
    (error) => {
      assert.equal(error.code, 'ERR_UPDATE_INTEGRITY_MISMATCH');
      assert.equal(error.retryable, false);
      assert.match(error.message, /避免重复下载/);
      return true;
    }
  );

  assert.deepEqual(requested, [mirrorURL]);
});

test('checks for a newer version before downloading and reports download progress', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installer = Buffer.from('signed-kaiyue-installer');
  const installerURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.2/KaiyueMail-win32-x64-1.0.2.exe';
  const requested = [];
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      if (requestUrl === installerURL) {
        return Readable.from([installer.subarray(0, 8), installer.subarray(8)]);
      }
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.2',
        url: installerURL,
        sha256: crypto.createHash('sha256').update(installer).digest('hex'),
        size: installer.length,
        notes: '企业邮箱安全更新',
      });
    },
    verifyAuthenticode: async () => true,
  });
  const progress = [];
  engine.on('download-progress', (detail) => progress.push(detail));

  const update = await engine.check(
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    '1.0.1'
  );

  assert.equal(update.version, '1.0.2');
  assert.equal(update.notes, '企业邮箱安全更新');
  assert.deepEqual(requested, [
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
  ]);

  const prepared = await engine.download(update);

  assert.deepEqual(fs.readFileSync(prepared.filePath), installer);
  assert.equal(progress.at(-1).percent, 100);
  assert.equal(progress.at(-1).transferred, installer.length);
  assert.equal(progress.at(-1).total, installer.length);
  assert.deepEqual(requested, [
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    installerURL,
  ]);
});

test('falls back to GitHub when the company mirror manifest is unavailable', async () => {
  const mirrorManifest = 'https://download.kaiyue-ai.com/kaiyue-update-win32-x64.json';
  const githubManifest =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json';
  const requested = [];
  const engine = new NsisUpdateEngine({
    requestStream: async (requestUrl) => {
      requested.push(requestUrl);
      if (requestUrl === mirrorManifest) throw new Error('mirror unavailable');
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.6',
        url: 'https://download.kaiyue-ai.com/v1.0.6/KaiyueMail-win32-x64-1.0.6.exe',
        fallbackUrls: [
          'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.6/KaiyueMail-win32-x64-1.0.6.exe',
        ],
        sha256: 'a'.repeat(64),
        size: 10,
      });
    },
  });

  const result = await engine.check([mirrorManifest, githubManifest], '1.0.6');

  assert.equal(result, null);
  assert.deepEqual(requested, [mirrorManifest, githubManifest]);
});

test('reports transferred bytes before a large installer reaches one percent', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const firstChunk = Buffer.alloc(64 * 1024, 1);
  const remainingChunk = Buffer.alloc(10 * 1024 * 1024 - firstChunk.length, 2);
  const installer = Buffer.concat([firstChunk, remainingChunk]);
  let releaseRemainingChunk;
  const remainingChunkGate = new Promise((resolve) => {
    releaseRemainingChunk = resolve;
  });
  let firstChunkProcessed;
  const firstChunkProcessedPromise = new Promise((resolve) => {
    firstChunkProcessed = resolve;
  });
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async () =>
      Readable.from(
        (async function* installerStream() {
          yield firstChunk;
          firstChunkProcessed();
          await remainingChunkGate;
          yield remainingChunk;
        })()
      ),
    verifyAuthenticode: async () => true,
  });
  const progress = [];
  engine.on('download-progress', (detail) => progress.push(detail));
  const manifest = {
    version: '1.0.2',
    url: 'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.2/KaiyueMail-win32-x64-1.0.2.exe',
    sha256: crypto.createHash('sha256').update(installer).digest('hex'),
    size: installer.length,
    notes: '',
  };

  const downloadPromise = engine.download(manifest);
  await firstChunkProcessedPromise;

  assert.equal(
    progress.some((detail) => detail.percent === 0 && detail.transferred > 0),
    true
  );

  releaseRemainingChunk();
  await downloadPromise;
});

test('launches only an unchanged prepared installer as a detached silent update', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installerPath = path.join(tempRoot, 'KaiyueMail-win32-x64-1.0.2.exe');
  const installer = Buffer.from('verified-installer');
  fs.writeFileSync(installerPath, installer);
  const launches = [];
  const engine = new NsisUpdateEngine({
    requestStream: async () => {
      throw new Error('not used');
    },
    verifyAuthenticode: async () => true,
    processId: 4242,
    spawnDetached: async (executable, args) => launches.push({ executable, args }),
  });
  const update = {
    filePath: installerPath,
    version: '1.0.2',
    sha256: crypto.createHash('sha256').update(installer).digest('hex'),
    size: installer.length,
    notes: '',
  };

  await engine.install(update);

  assert.deepEqual(launches, [
    {
      executable: update.filePath,
      args: ['/S', '/UPDATE', '/PARENT_PID=4242'],
    },
  ]);

  fs.appendFileSync(installerPath, 'changed-after-verification');
  await assert.rejects(engine.install(update), /changed after verification/);
  assert.equal(launches.length, 1);
});

test('stops a download as soon as it exceeds the manifest size', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-update-test-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const installerURL =
    'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.0.2/KaiyueMail-win32-x64-1.0.2.exe';
  let requestCount = 0;
  const engine = new NsisUpdateEngine({
    tempRoot,
    requestStream: async () => {
      requestCount += 1;
      if (requestCount === 2) return Readable.from([Buffer.alloc(20)]);
      return jsonStream({
        schemaVersion: 1,
        version: '1.0.2',
        url: installerURL,
        sha256: 'a'.repeat(64),
        size: 10,
      });
    },
    verifyAuthenticode: async () => true,
  });

  await assert.rejects(
    engine.prepare(
      'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
      '1.0.1'
    ),
    (error) => {
      assert.equal(error.code, 'ERR_UPDATE_SIZE_MISMATCH');
      assert.equal(error.retryable, false);
      assert.match(error.message, /避免重复下载/);
      return true;
    }
  );
});

test('trusts only a valid Authenticode signature from an allowed company publisher', () => {
  const allowed = ['Mengyin Kaiyue Construction Machinery Co., Ltd.', '蒙阴县凯越工程机械有限公司'];
  assert.equal(
    isTrustedAuthenticodeSignature(
      {
        status: 'Valid',
        subject:
          'CN=Mengyin Kaiyue Construction Machinery Co., Ltd., O=Mengyin Kaiyue Construction Machinery Co., Ltd., C=CN',
      },
      allowed
    ),
    true
  );
  assert.equal(
    isTrustedAuthenticodeSignature(
      {
        status: 'Valid',
        subject:
          'CN="Mengyin Kaiyue Construction Machinery Co., Ltd.", O="Mengyin Kaiyue Construction Machinery Co., Ltd."',
      },
      allowed
    ),
    true
  );
  assert.equal(
    isTrustedAuthenticodeSignature(
      { status: 'Valid', subject: 'CN=Unrelated Software Vendor, C=US' },
      allowed
    ),
    false
  );
  assert.equal(
    isTrustedAuthenticodeSignature(
      {
        status: 'Valid',
        subject: 'CN=Fake Mengyin Kaiyue Construction Machinery Co., Ltd. Publisher, C=US',
      },
      allowed
    ),
    false
  );
});

test('installs the pinned internal root and retries an untrusted company signature', async () => {
  const allowed = ['Mengyin Kaiyue Construction Machinery Co., Ltd.'];
  const companySubject =
    'CN=Mengyin Kaiyue Construction Machinery Co., Ltd., O=Mengyin Kaiyue Construction Machinery Co., Ltd.';
  const signatures = [
    {
      status: 'UnknownError',
      statusMessage:
        'A certificate chain processed, but terminated in a root certificate which is not trusted by the trust provider.',
      subject: companySubject,
    },
    { status: 'Valid', statusMessage: 'Signature verified.', subject: companySubject },
  ];
  const events = [];

  const trusted = await verifyAuthenticode('KaiyueMailSetup.exe', allowed, {
    inspectAuthenticode: async () => {
      events.push('inspect');
      return signatures.shift();
    },
    installInternalRoot: async () => {
      events.push('install-root');
      return true;
    },
  });

  assert.equal(trusted, true);
  assert.deepEqual(events, ['inspect', 'install-root', 'inspect']);
});

test('does not install internal trust for an unrelated publisher', async () => {
  const events = [];
  const trusted = await verifyAuthenticode(
    'UnrelatedSetup.exe',
    ['Mengyin Kaiyue Construction Machinery Co., Ltd.'],
    {
      inspectAuthenticode: async () => ({
        status: 'NotTrusted',
        statusMessage: 'The certificate is not trusted.',
        subject: 'CN=Unrelated Software Vendor, O=Unrelated Software Vendor',
      }),
      installInternalRoot: async () => {
        events.push('install-root');
        return true;
      },
    }
  );

  assert.equal(trusted, false);
  assert.deepEqual(events, []);
});

test('does not install internal trust for a damaged company-signed installer', async () => {
  const events = [];
  const trusted = await verifyAuthenticode(
    'DamagedKaiyueMailSetup.exe',
    ['Mengyin Kaiyue Construction Machinery Co., Ltd.'],
    {
      inspectAuthenticode: async () => ({
        status: 'HashMismatch',
        statusMessage: 'The contents of the file do not match its signature.',
        subject:
          'CN=Mengyin Kaiyue Construction Machinery Co., Ltd., O=Mengyin Kaiyue Construction Machinery Co., Ltd.',
      }),
      installInternalRoot: async () => {
        events.push('install-root');
        return true;
      },
    }
  );

  assert.equal(trusted, false);
  assert.deepEqual(events, []);
});
