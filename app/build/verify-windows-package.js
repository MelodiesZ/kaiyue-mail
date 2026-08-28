/* eslint global-require: 0 */
const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
const nodeAbi = require('node-abi');
const rootPackage = require('../../package.json');

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
const mailsyncRuntimeDir = path.join(unpackedDir, 'mailspring-runtime');
const mailsyncPath = path.join(mailsyncRuntimeDir, 'mailsync.exe');
const sqlitePath = path.join(
  unpackedDir,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const mailsyncRuntimeFiles = [
  'mailsync.exe',
  'libcurl.dll',
  'libxml2.dll',
  'mailcore2.dll',
  'libcrypto-3.dll',
  'libetpan.dll',
  'libsasl.dll',
  'libssl-3.dll',
  'tidy.dll',
  'icudt78.dll',
  'icuin78.dll',
  'icuuc78.dll',
  'msvcp140.dll',
  'vcruntime140.dll',
  'zlib1.dll',
];

requirePE(exePath, 'Kaiyue Mail executable');
mailsyncRuntimeFiles.forEach((name) => {
  requirePE(path.join(mailsyncRuntimeDir, name), name);
});
requirePE(sqlitePath, 'better_sqlite3.node');
requireFile(asarPath, 'app.asar');

const config = JSON.parse(asar.extractFile(asarPath, 'kaiyue-config.json').toString());
const packagedApp = JSON.parse(asar.extractFile(asarPath, 'package.json').toString());
const electronVersion = packagedApp.resolutions.electron;
const expectedNativeModuleABI = Number(nodeAbi.getAbi(electronVersion, 'electron'));
const sqliteBinaryText = fs.readFileSync(sqlitePath).toString('latin1');
const sqliteABIMatch = sqliteBinaryText.match(/node_register_module_v(\d+)/);
const actualNativeModuleABI = sqliteABIMatch ? Number(sqliteABIMatch[1]) : null;
const notificationIPC = asar.extractFile(asarPath, 'src/browser/notification-ipc.js').toString();
const mailsyncProcess = asar.extractFile(asarPath, 'src/mailsync-process.js').toString();
const notificationUtils = asar
  .extractFile(asarPath, 'src/windows-notification-utils.js')
  .toString();
const defaultClientHelper = asar.extractFile(asarPath, 'src/default-client-helper.js').toString();
const windowsUpdater = asar.extractFile(asarPath, 'src/browser/windows-updater.js').toString();
const autoUpdateManager = asar.extractFile(asarPath, 'src/browser/autoupdate-manager.js').toString();
const nsisUpdateEngine = asar.extractFile(asarPath, 'src/browser/nsis-update-engine.js').toString();
const mainWindowHTML = asar.extractFile(asarPath, 'static/index.html').toString();
const migrationWindowHTML = asar.extractFile(asarPath, 'static/db-migration.html').toString();
const vacuumWindowHTML = asar.extractFile(asarPath, 'static/db-vacuum.html').toString();
const registryTemplate = fs.readFileSync(
  path.join(resourcesDir, 'mailspring-mailto-registration.reg'),
  'utf8'
);
const installerScript = fs.readFileSync(
  path.join(__dirname, 'windows-installer', 'installer.nsi'),
  'utf8'
);
const installerBuildScript = fs.readFileSync(
  path.join(__dirname, 'build-windows-installer.js'),
  'utf8'
);
const installerSidebarSvg = fs.readFileSync(
  path.join(__dirname, 'windows-installer', 'assets', 'installer-sidebar.svg'),
  'utf8'
);
const installerHeaderSvg = fs.readFileSync(
  path.join(__dirname, 'windows-installer', 'assets', 'installer-header.svg'),
  'utf8'
);

const checks = {
  platformExecutable: true,
  mailsyncPE: true,
  mailsyncRuntimeComplete: true,
  brandedRuntimePathCompatible:
    path.basename(mailsyncRuntimeDir).toLowerCase().includes('mailspring') &&
    mailsyncProcess.includes('mailspring-runtime'),
  sqlitePE: true,
  sqliteABI: actualNativeModuleABI === expectedNativeModuleABI,
  appVersion: packagedApp.version === rootPackage.version,
  brandCompany: config.brand.company === '蒙阴县凯越工程机械有限公司',
  brandPositioning: config.brand.positioning === '自主研发企业邮件客户端',
  brandedWindowTitles:
    mainWindowHTML.includes('<title>凯越邮箱</title>') &&
    migrationWindowHTML.includes('<title>正在升级凯越邮箱数据库…</title>') &&
    vacuumWindowHTML.includes('<title>正在整理凯越邮箱数据…</title>') &&
    ![mainWindowHTML, migrationWindowHTML, vacuumWindowHTML].some((html) =>
      /<title>[^<]*Mailspring/i.test(html)
    ),
  protocol: config.brand.protocol === 'kaiyuemail',
  nativeNotificationAPI:
    notificationIPC.includes('new electron_1.Notification') &&
    notificationIPC.includes('notification.show()'),
  brandedToastActivation: notificationUtils.includes('KaiyueConfig.brand.protocol'),
  notificationAUMID:
    windowsUpdater.includes('appUserModelId') &&
    windowsUpdater.includes('toastActivatorClsid') &&
    windowsUpdater.includes('ensureNotificationShortcut'),
  nsisOnlineUpdater:
    autoUpdateManager.includes('autoupdate-impl-win32') &&
    autoUpdateManager.includes('distribution: process.platform') &&
    autoUpdateManager.includes("? 'nsis'") &&
    nsisUpdateEngine.includes('Get-AuthenticodeSignature') &&
    nsisUpdateEngine.includes('/PARENT_PID='),
  protocolRegistry:
    registryTemplate.includes('SOFTWARE\\Classes\\kaiyuemail') &&
    registryTemplate.includes('URL:Kaiyue Mail Protocol') &&
    registryTemplate.includes('{{PROTOCOL_OPEN_COMMAND}}'),
  defaultMailRegistration:
    registryTemplate.includes('"ApplicationName"="Kaiyue Mail"') &&
    registryTemplate.includes('"Mail"="KaiyueMail"') &&
    registryTemplate.includes('"mailto"="KaiyueMail.Url.mailto"') &&
    registryTemplate.includes(
      '"Kaiyue Mail"="Software\\\\Clients\\\\Mail\\\\KaiyueMail\\\\Capabilities"'
    ) &&
    registryTemplate.includes('SOFTWARE\\Classes\\KaiyueMail.Url.mailto\\DefaultIcon') &&
    registryTemplate.includes('"URL Protocol"=""'),
  defaultMailSettingsLink:
    defaultClientHelper.includes("windowsRegisteredAppName = 'Kaiyue Mail'") &&
    defaultClientHelper.includes("windowsMailtoProgId = 'KaiyueMail.Url.mailto'") &&
    defaultClientHelper.includes('registeredAppUser='),
  nsisDefaultMailRegistration:
    installerScript.includes('!define REGISTERED_APP_NAME "Kaiyue Mail"') &&
    installerScript.includes('!define MAIL_CLIENT_ID "KaiyueMail"') &&
    installerScript.includes('!define MAILTO_PROGID "KaiyueMail.Url.mailto"') &&
    installerScript.includes('"${MAIL_CLIENT_KEY}\\Capabilities\\URLAssociations"') &&
    installerScript.includes('"Software\\RegisteredApplications" "${REGISTERED_APP_NAME}"'),
  nsisBrandPositioning:
    installerScript.includes('!define PRODUCT_PUBLISHER "蒙阴县凯越工程机械有限公司"') &&
    installerScript.includes('!define PRODUCT_POSITIONING "自主研发企业邮件客户端"') &&
    installerScript.includes('${PRODUCT_PUBLISHER}${PRODUCT_POSITIONING}'),
  nsisUsesCanonicalProductIcon:
    installerScript.includes('Icon "..\\resources\\win\\kaiyue-mail.ico"') &&
    installerScript.includes('!define MUI_ICON "..\\resources\\win\\kaiyue-mail.ico"') &&
    installerSidebarSvg.includes('kaiyue-mail-icon.png') &&
    installerHeaderSvg.includes('kaiyue-mail-icon.png'),
  nsisWelcomeCopyLayout:
    installerScript.includes('蒙阴县凯越工程机械有限公司自主研发。$\\r$\\n企业邮件客户端') &&
    installerScript.includes('安装大约需要一分钟。$\\r$\\n继续前，请保存草稿并退出凯越邮箱。'),
  nsisVersionFromPackage:
    installerScript.includes('!ifndef PRODUCT_VERSION') &&
    installerScript.includes('VIProductVersion "${PRODUCT_VERSION_QUAD}"') &&
    installerBuildScript.includes('packageJson.version') &&
    installerBuildScript.includes('`-DPRODUCT_VERSION=${productVersion}`'),
  nsisSilentUpdateMode:
    installerScript.includes('${GetOptions} $0 "/UPDATE"') &&
    installerScript.includes('${GetOptions} $0 "/PARENT_PID="') &&
    installerScript.includes('WaitForSingleObject') &&
    installerScript.includes('StrCpy $InstallPayloadDir "$INSTDIR.update"') &&
    installerScript.includes('Rename "$PreviousInstallDir" "$INSTDIR"') &&
    installerScript.includes('"DesktopShortcut"') &&
    installerScript.includes("Exec '\"$INSTDIR\\${PRODUCT_EXE}\"'"),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
console.log(
  JSON.stringify(
    { appDir, electronVersion, expectedNativeModuleABI, actualNativeModuleABI, checks },
    null,
    2
  )
);

if (failed.length) {
  throw new Error(`Windows package verification failed: ${failed.join(', ')}`);
}
