#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { isTrustedAuthenticodeSignature } = require('../app/src/browser/nsis-update-engine');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifyAuthenticodeSync(installerPath, allowedPublishers) {
  if (process.platform !== 'win32') {
    throw new Error('Authenticode verification must run on the Windows release machine.');
  }
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
  const output = execFileSync(
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
    { encoding: 'utf8', windowsHide: true }
  );
  const signature = JSON.parse(output);
  if (!isTrustedAuthenticodeSignature(signature, allowedPublishers)) {
    throw new Error(
      `Installer Authenticode publisher is not trusted: ${signature.subject || 'none'}`
    );
  }
}

function verifyWindowsUpdateAssets({
  manifestPath,
  expectedVersion,
  expectedRepository,
  allowedPublishers = [],
  requireSignature = false,
}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('Windows update manifest schema is invalid.');
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `Windows update manifest version ${manifest.version} does not match ${expectedVersion}.`
    );
  }
  const installerName = `KaiyueMail-win32-x64-${expectedVersion}.exe`;
  const expectedURL = `https://github.com/${expectedRepository}/releases/download/v${expectedVersion}/${installerName}`;
  if (manifest.url !== expectedURL) throw new Error('Windows update installer URL is invalid.');
  if (!/^[a-f\d]{64}$/.test(`${manifest.sha256 || ''}`)) {
    throw new Error('Windows update manifest SHA-256 is invalid.');
  }

  const installerPath = path.join(path.dirname(manifestPath), installerName);
  if (!fs.existsSync(installerPath))
    throw new Error(`Windows update installer is missing: ${installerPath}`);
  const size = fs.statSync(installerPath).size;
  if (size !== manifest.size)
    throw new Error('Windows update installer size does not match manifest.');
  const sha256 = sha256File(installerPath);
  if (sha256 !== manifest.sha256) {
    throw new Error('Windows update installer SHA-256 does not match manifest.');
  }
  const checksumPath = `${installerPath}.sha256`;
  const expectedChecksum = `${sha256}  ${installerName}\n`;
  if (!fs.existsSync(checksumPath) || fs.readFileSync(checksumPath, 'utf8') !== expectedChecksum) {
    throw new Error('Windows update checksum file does not match the installer.');
  }
  if (requireSignature) verifyAuthenticodeSync(installerPath, allowedPublishers);
  return { installerPath, checksumPath, sha256, size };
}

function run() {
  const repositoryRoot = path.resolve(__dirname, '..');
  const rootPackage = require(path.join(repositoryRoot, 'package.json'));
  const config = require(path.join(repositoryRoot, 'app', 'kaiyue-config.json'));
  const result = verifyWindowsUpdateAssets({
    manifestPath: path.join(repositoryRoot, 'app', 'dist', 'kaiyue-update-win32-x64.json'),
    expectedVersion: rootPackage.version,
    expectedRepository: config.updater.repository,
    allowedPublishers: [config.brand.company, config.brand.companyEnglish],
    requireSignature: process.argv.includes('--require-signature'),
  });
  console.log(`Windows update assets verified (${result.size} bytes, SHA-256 ${result.sha256}).`);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`Windows update asset verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyWindowsUpdateAssets, verifyAuthenticodeSync };
