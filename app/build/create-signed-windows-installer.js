/* eslint import/no-dynamic-require:0 */
/**
 * Code signing is handled separately by the Azure Trusted Signing action in
 * the GitHub workflow. This script creates an unsigned installer which is
 * then signed by the workflow after creation.
 */
const path = require('path');
const { createWindowsInstaller } = require('electron-winstaller');

const appDir = path.join(__dirname, '..');
const { version, description } = require(path.join(appDir, 'package.json'));
const kaiyueConfig = require(path.join(appDir, 'kaiyue-config.json'));

const config = {
  usePackageJson: false,
  outputDirectory: path.join(appDir, 'dist'),
  appDirectory: path.join(appDir, 'dist', 'Kaiyue Mail-win32-x64'),
  loadingGif: path.join(appDir, 'build', 'resources', 'win', 'loading.gif'),
  description,
  version: version,
  title: kaiyueConfig.brand.name,
  authors: kaiyueConfig.brand.companyEnglish,
  setupIcon: path.join(appDir, 'build', 'resources', 'win', 'kaiyue-mail.ico'),
  // rcedit.exe is only needed to brand the Squirrel.exe embedded inside the
  // app directory. On a non-Windows cross-build it requires a full Wine GUI
  // runtime; the final Setup.exe still receives setupIcon via Squirrel-Mono.
  skipUpdateIcon: process.platform !== 'win32',
  noMsi: true,
  setupExe: 'KaiyueMailSetup.exe',
  exe: 'Kaiyue Mail.exe',
  name: 'KaiyueMail',
};

console.log(config);
console.log('---> Starting');

createWindowsInstaller(config)
  .then(() => {
    console.log('createWindowsInstaller succeeded.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(`createWindowsInstaller failed: ${e.message}`);
    process.exit(1);
  });
