#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function prepareWindowsUpdateAssets({
  sourceInstaller,
  outputDir,
  version,
  repository,
  downloadBaseUrl,
  notes = '',
}) {
  if (!/^\d+\.\d+\.\d+$/.test(`${version || ''}`)) {
    throw new Error('Windows update assets require a stable semantic version.');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(`${repository || ''}`)) {
    throw new Error('Windows update assets require a GitHub owner/repository value.');
  }
  if (!fs.existsSync(sourceInstaller)) {
    throw new Error(`Windows installer is missing: ${sourceInstaller}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const installerName = `KaiyueMail-win32-x64-${version}.exe`;
  const installerPath = path.join(outputDir, installerName);
  if (path.resolve(sourceInstaller) !== path.resolve(installerPath)) {
    fs.copyFileSync(sourceInstaller, installerPath);
  }
  const contents = fs.readFileSync(installerPath);
  const sha256 = crypto.createHash('sha256').update(contents).digest('hex');
  const checksumPath = `${installerPath}.sha256`;
  fs.writeFileSync(checksumPath, `${sha256}  ${installerName}\n`);

  const manifestPath = path.join(outputDir, 'kaiyue-update-win32-x64.json');
  const githubURL = `https://github.com/${repository}/releases/download/v${version}/${installerName}`;
  let mirrorURL;
  if (downloadBaseUrl) {
    const parsedDownloadBaseURL = new URL(downloadBaseUrl);
    if (parsedDownloadBaseURL.protocol !== 'https:') {
      throw new Error('Windows update download base URL must use HTTPS.');
    }
    mirrorURL = new URL(
      `v${version}/${installerName}`,
      `${parsedDownloadBaseURL.href.replace(/\/$/, '')}/`
    ).href;
  }
  const manifest = {
    schemaVersion: 1,
    version,
    url: mirrorURL || githubURL,
    ...(mirrorURL ? { fallbackUrls: [githubURL] } : {}),
    sha256,
    size: contents.length,
    notes,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { installerPath, checksumPath, manifestPath, manifest };
}

function run() {
  const repositoryRoot = path.resolve(__dirname, '..');
  const appDir = path.join(repositoryRoot, 'app');
  const rootPackage = require(path.join(repositoryRoot, 'package.json'));
  const config = require(path.join(appDir, 'kaiyue-config.json'));
  const notesFileIndex = process.argv.indexOf('--notes-file');
  const notesFile = notesFileIndex >= 0 ? process.argv[notesFileIndex + 1] : undefined;
  if (notesFileIndex >= 0 && !notesFile) throw new Error('--notes-file requires a path.');
  const notes = notesFile
    ? fs.readFileSync(path.resolve(notesFile), 'utf8').trim()
    : `凯越邮箱 ${rootPackage.version} 安全与稳定性更新`;
  const result = prepareWindowsUpdateAssets({
    sourceInstaller: path.join(appDir, 'dist', 'KaiyueMailSetup.exe'),
    outputDir: path.join(appDir, 'dist'),
    version: rootPackage.version,
    repository: config.updater.repository,
    downloadBaseUrl: config.updater.downloadBaseUrl,
    notes,
  });
  console.log(`Windows update installer: ${result.installerPath}`);
  console.log(`Windows update checksum: ${result.checksumPath}`);
  console.log(`Windows update manifest: ${result.manifestPath}`);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`Windows update asset preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { prepareWindowsUpdateAssets };
