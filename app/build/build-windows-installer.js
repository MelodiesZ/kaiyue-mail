/* eslint global-require: 0 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const appDir = path.join(rootDir, 'app');
const packageDir = path.join(appDir, 'dist', 'Kaiyue Mail-win32-x64');
const installerDir = path.join(appDir, 'build', 'windows-installer');
const installerScript = path.join(installerDir, 'installer.nsi');
const outputFile = path.join(appDir, 'dist', 'KaiyueMailSetup.exe');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const kaiyueConfig = JSON.parse(fs.readFileSync(path.join(appDir, 'kaiyue-config.json'), 'utf8'));
const internalTrustConfig = JSON.parse(
  fs.readFileSync(path.join(appDir, 'internal-trust.json'), 'utf8')
);
const productVersion = packageJson.version;
const versionParts = productVersion.split('.');
if (!/^\d+\.\d+\.\d+$/.test(productVersion)) {
  throw new Error(`Windows installer requires a stable semantic version: ${productVersion}`);
}
const productVersionQuad = [...versionParts, '0'].join('.');
const canonicalProductIcon = path.join(
  appDir,
  'build',
  'resources',
  'branding',
  'kaiyue-mail-icon.png'
);
const installerProductIcon = path.join(installerDir, 'assets', 'kaiyue-mail-icon.png');
const internalRootCertificate = path.join(
  installerDir,
  'certificates',
  internalTrustConfig.certificateFileName
);
const expectedInternalRootSha256 = internalTrustConfig.certificateSha256.toLowerCase();
const required = [
  path.join(packageDir, 'Kaiyue Mail.exe'),
  path.join(packageDir, 'resources', 'app.asar'),
  path.join(appDir, 'build', 'resources', 'win', 'kaiyue-mail.ico'),
  canonicalProductIcon,
  installerProductIcon,
  path.join(installerDir, 'assets', 'installer-sidebar-background-v2.png'),
  path.join(installerDir, 'assets', 'installer-sidebar-background-v2.prompt.md'),
  path.join(installerDir, 'assets', 'installer-sidebar.bmp'),
  path.join(installerDir, 'assets', 'installer-header.bmp'),
  internalRootCertificate,
  path.join(rootDir, 'scripts', 'windows', internalTrustConfig.installScriptFileName),
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Windows installer input is missing: ${file}`);
  }
}

if (!fs.readFileSync(canonicalProductIcon).equals(fs.readFileSync(installerProductIcon))) {
  throw new Error('Windows installer artwork is not using the canonical Kaiyue Mail icon.');
}

const actualInternalRootSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(internalRootCertificate))
  .digest('hex');
if (actualInternalRootSha256 !== expectedInternalRootSha256) {
  throw new Error(
    `Windows installer internal root certificate does not match the pinned certificate: ${actualInternalRootSha256}`
  );
}

execFileSync(process.execPath, [path.join(__dirname, 'verify-windows-package.js'), packageDir], {
  cwd: rootDir,
  stdio: 'inherit',
});

if (process.platform !== 'win32') {
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, 'verify-windows-runtime-dependencies.js'),
      path.join(packageDir, 'resources', 'app.asar.unpacked', 'mailspring-runtime', 'mailsync.exe'),
    ],
    { cwd: rootDir, stdio: 'inherit' }
  );
}

try {
  execFileSync('makensis', ['-VERSION'], { stdio: 'ignore' });
} catch (error) {
  throw new Error('NSIS is required. Install it with `brew install nsis` and retry.');
}

execFileSync(
  'makensis',
  [
    `-DAPP_SOURCE=${packageDir}`,
    `-DOUTPUT_FILE=${outputFile}`,
    `-DPRODUCT_VERSION=${productVersion}`,
    `-DPRODUCT_VERSION_QUAD=${productVersionQuad}`,
    `-DPRODUCT_PUBLISHER=${kaiyueConfig.brand.company}`,
    `-DPRODUCT_POSITIONING=${kaiyueConfig.brand.positioning}`,
    `-DINTERNAL_ROOT_SHA256=${expectedInternalRootSha256.toUpperCase()}`,
    installerScript,
  ],
  { cwd: installerDir, stdio: 'inherit' }
);

if (!fs.existsSync(outputFile)) {
  throw new Error(`Installer was not created: ${outputFile}`);
}

console.log(`---> Created branded Windows installer ${productVersion}: ${outputFile}`);
