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

test('Windows installer embeds only the pinned public root certificate', () => {
  assert.equal(fs.existsSync(certificatePath), true, 'embedded public root certificate is missing');
  const actualSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(certificatePath))
    .digest('hex');
  assert.equal(actualSha256, expectedSha256);

  const installerSource = fs.readFileSync(path.join(installerDirectory, 'installer.nsi'), 'utf8');
  const trustScript = fs.readFileSync(
    path.join(repositoryRoot, 'scripts', 'windows', 'Install-KaiyueMailInternalRoot.ps1'),
    'utf8'
  );
  assert.match(installerSource, /KaiyueMail-Internal-Root-CA\.cer/);
  assert.match(installerSource, /Install-KaiyueMailInternalRoot\.ps1/);
  assert.match(installerSource, /-NonInteractive/);
  assert.match(trustScript, /X509Store/);
  assert.match(trustScript, /StoreName\]::Root/);
  assert.match(trustScript, /StoreLocation\]::CurrentUser/);
  assert.match(trustScript, /OpenFlags\]::ReadWrite/);
  assert.match(trustScript, /\.Add\(\$certificate\)/);
  assert.match(trustScript, /SHA256\]::Create\(\)/);
  assert.doesNotMatch(trustScript, /Get-FileHash/);
  assert.doesNotMatch(trustScript, /Import-Certificate/);
  assert.doesNotMatch(trustScript, /Cert:\\CurrentUser\\Root/);
  assert.doesNotMatch(installerSource, /LocalMachine/);
  assert.doesNotMatch(trustScript, /LocalMachine/);
});

test('installer build rejects a replaced internal root certificate', () => {
  const buildSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'build', 'build-windows-installer.js'),
    'utf8'
  );
  const appBuildSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'build', 'build.js'),
    'utf8'
  );
  assert.equal(internalTrustConfig.certificateSha256, expectedSha256);
  assert.match(buildSource, /internalTrustConfig\.certificateSha256/);
  assert.match(buildSource, /createHash\('sha256'\)/);
  assert.match(buildSource, /-DINTERNAL_ROOT_SHA256/);
  assert.match(buildSource, /internal root certificate/i);
  assert.match(appBuildSource, /extraResource/);
  assert.match(appBuildSource, /windowsInternalTrustResources/);
  assert.match(appBuildSource, /internalTrustConfig\.certificateFileName/);
  assert.match(appBuildSource, /internalTrustConfig\.installScriptFileName/);
});
