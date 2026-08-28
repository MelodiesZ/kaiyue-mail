const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const installerDirectory = path.join(repositoryRoot, 'app', 'build', 'windows-installer');
const certificatePath = path.join(
  installerDirectory,
  'certificates',
  'KaiyueMail-Internal-Root-CA.cer'
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
  assert.match(trustScript, /Cert:\\CurrentUser\\Root/);
  assert.doesNotMatch(installerSource, /LocalMachine/);
  assert.doesNotMatch(trustScript, /LocalMachine/);
});

test('installer build rejects a replaced internal root certificate', () => {
  const buildSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'build', 'build-windows-installer.js'),
    'utf8'
  );
  assert.match(buildSource, /1a242d335668c4a06c912c40e173ca7afc2aeefe861c3167ae03c91f7d7c4d66/i);
  assert.match(buildSource, /createHash\('sha256'\)/);
  assert.match(buildSource, /internal root certificate/i);
});
