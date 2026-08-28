const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareWindowsUpdateAssets } = require('./prepare-windows-update-assets');
const { verifyWindowsUpdateAssets } = require('./verify-windows-update-assets');

test('creates a versioned installer, checksum, and latest-release manifest', (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-assets-test-'));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const sourceInstaller = path.join(outputDir, 'KaiyueMailSetup.exe');
  const contents = Buffer.from('signed-installer-contents');
  fs.writeFileSync(sourceInstaller, contents);

  const result = prepareWindowsUpdateAssets({
    sourceInstaller,
    outputDir,
    version: '1.2.3',
    repository: 'MelodiesZ/kaiyue-mail',
    notes: '凯越邮箱 1.2.3 安全更新',
  });

  const expectedHash = crypto.createHash('sha256').update(contents).digest('hex');
  assert.equal(path.basename(result.installerPath), 'KaiyueMail-win32-x64-1.2.3.exe');
  assert.deepEqual(fs.readFileSync(result.installerPath), contents);
  assert.equal(
    fs.readFileSync(result.checksumPath, 'utf8'),
    `${expectedHash}  KaiyueMail-win32-x64-1.2.3.exe\n`
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(result.manifestPath, 'utf8')), {
    schemaVersion: 1,
    version: '1.2.3',
    url: 'https://github.com/MelodiesZ/kaiyue-mail/releases/download/v1.2.3/KaiyueMail-win32-x64-1.2.3.exe',
    sha256: expectedHash,
    size: contents.length,
    notes: '凯越邮箱 1.2.3 安全更新',
  });
  assert.equal(
    verifyWindowsUpdateAssets({
      manifestPath: result.manifestPath,
      expectedVersion: '1.2.3',
      expectedRepository: 'MelodiesZ/kaiyue-mail',
    }).sha256,
    expectedHash
  );
});

test('rejects an installer changed after its update manifest was generated', (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-assets-test-'));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const sourceInstaller = path.join(outputDir, 'KaiyueMailSetup.exe');
  fs.writeFileSync(sourceInstaller, 'signed-installer-contents');
  const result = prepareWindowsUpdateAssets({
    sourceInstaller,
    outputDir,
    version: '1.2.3',
    repository: 'MelodiesZ/kaiyue-mail',
  });
  fs.appendFileSync(result.installerPath, 'tampered');

  assert.throws(
    () =>
      verifyWindowsUpdateAssets({
        manifestPath: result.manifestPath,
        expectedVersion: '1.2.3',
        expectedRepository: 'MelodiesZ/kaiyue-mail',
      }),
    /size does not match|SHA-256 does not match/
  );
});
