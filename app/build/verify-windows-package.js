/* eslint global-require: 0 */
const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

const appDir = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'dist', 'Kaiyue Mail-win32-x64')
);

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  return filePath;
}

function requirePE(filePath, label) {
  requireFile(filePath, label);
  if (fs.readFileSync(filePath).subarray(0, 2).toString('ascii') !== 'MZ') {
    throw new Error(`${label} is not a Windows PE binary: ${filePath}`);
  }
}

const exePath = path.join(appDir, 'Kaiyue Mail.exe');
const resourcesDir = path.join(appDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
const mailsyncPath = path.join(unpackedDir, 'mailsync.exe');
const sqlitePath = path.join(
  unpackedDir,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);

requirePE(exePath, 'Kaiyue Mail executable');
requirePE(mailsyncPath, 'mailsync.exe');
requirePE(sqlitePath, 'better_sqlite3.node');
requireFile(asarPath, 'app.asar');

const config = JSON.parse(asar.extractFile(asarPath, 'kaiyue-config.json').toString());
const notificationIPC = asar.extractFile(asarPath, 'src/browser/notification-ipc.js').toString();
const notificationUtils = asar
  .extractFile(asarPath, 'src/windows-notification-utils.js')
  .toString();
const windowsUpdater = asar.extractFile(asarPath, 'src/browser/windows-updater.js').toString();
const registryTemplate = fs.readFileSync(
  path.join(resourcesDir, 'mailspring-mailto-registration.reg'),
  'utf8'
);

const checks = {
  platformExecutable: true,
  mailsyncPE: true,
  sqlitePE: true,
  protocol: config.brand.protocol === 'kaiyuemail',
  nativeNotificationAPI:
    notificationIPC.includes('new electron_1.Notification') &&
    notificationIPC.includes('notification.show()'),
  brandedToastActivation: notificationUtils.includes('KaiyueConfig.brand.protocol'),
  notificationAUMID:
    windowsUpdater.includes('appUserModelId') &&
    windowsUpdater.includes('toastActivatorClsid') &&
    windowsUpdater.includes('ensureNotificationShortcut'),
  protocolRegistry:
    registryTemplate.includes('SOFTWARE\\Classes\\kaiyuemail') &&
    registryTemplate.includes('URL:Kaiyue Mail Protocol') &&
    registryTemplate.includes('{{PROTOCOL_OPEN_COMMAND}}'),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
if (failed.length) {
  throw new Error(`Windows package verification failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ appDir, checks }, null, 2));
