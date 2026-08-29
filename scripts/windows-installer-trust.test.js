const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const installerDirectory = path.join(repositoryRoot, 'app', 'build', 'windows-installer');
const internalTrustConfig = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'app', 'internal-trust.json'), 'utf8')
);
const certificatePath = path.join(
  installerDirectory,
  'certificates',
  internalTrustConfig.certificateFileName
);
const expectedSha256 = '1a242d335668c4a06c912c40e173ca7afc2aeefe861c3167ae03c91f7d7c4d66';

test('legacy public root remains unchanged for release signing continuity', () => {
  assert.equal(fs.existsSync(certificatePath), true, 'pinned public root certificate is missing');
  const actualSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(certificatePath))
    .digest('hex');
  assert.equal(actualSha256, expectedSha256);
  assert.equal(internalTrustConfig.certificateSha256, expectedSha256);
});

test('Windows installation and online update do not require certificate deployment', () => {
  const installerSource = fs.readFileSync(path.join(installerDirectory, 'installer.nsi'), 'utf8');
  const installerBuildSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'build', 'build-windows-installer.js'),
    'utf8'
  );
  const appBuildSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'build', 'build.js'),
    'utf8'
  );
  const updaterSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'src', 'browser', 'nsis-update-engine.js'),
    'utf8'
  );
  for (const source of [installerSource, installerBuildSource, appBuildSource, updaterSource]) {
    assert.doesNotMatch(source, /Install-KaiyueMailInternalRoot/);
    assert.doesNotMatch(source, /INTERNAL_ROOT_/);
  }
  assert.doesNotMatch(updaterSource, /Get-AuthenticodeSignature/);
  assert.doesNotMatch(updaterSource, /ERR_UPDATE_SIGNATURE_NOT_TRUSTED/);
});
