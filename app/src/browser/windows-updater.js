/*
 * "Squirrel will spawn your app with command line flags on first run, updates,]
 * and uninstalls."
 *
 * Read: https://github.com/electron-archive/grunt-electron-installer#handling-squirrel-events
 * Read: https://github.com/electron/electron/blob/master/docs/api/auto-updater.md#windows
 *
 * When Mailspring gets installed on a Windows machine it gets put in:
 * C:\Users\<USERNAME>\AppData\Local\Mailspring\app-x.x.x
 *
 * The `process.execPath` is:
 * C:\Users\<USERNAME>\AppData\Local\Mailspring\app-x.x.x\nylas.exe
 *
 * We manually copy everything in build/resources/win into a 'resources' folder
 * located inside the main app directory. See runCopyPlatformSpecificResources
 * in package-task.js
 *
 * This means `__dirname` should be:
 * C:\Users\<USERNAME>\AppData\Local\Mailspring\app-x.x.x\resources
 *
 * We also expect Squirrel Windows to have a file called `nylas.exe` at:
 * C:\Users\<USERNAME>\AppData\Local\Mailspring\nylas.exe
 */
const ChildProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const kaiyueConfig = require('../../kaiyue-config.json');

const displayName = kaiyueConfig.brand.name;
const appUserModelId = kaiyueConfig.brand.applicationId;
const shortcutName = `${displayName}.lnk`;
const toastActivatorClsid = '{E6AD16B0-2830-48E7-9DB7-439152FA917B}';

// C:\Users\<USERNAME>\AppData\Local\Mailspring\app-x.x.x
const appFolder = path.resolve(process.execPath, '..');

// C:\Users\<USERNAME>\AppData\Local\Mailspring\
const rootAppDataFolder = path.resolve(appFolder, '..');

// C:\Users\<USERNAME>\AppData\Local\Mailspring\Update.exe
const updateDotExe = path.join(rootAppDataFolder, 'Update.exe');

// "mailspring.exe"
const exeName = path.basename(process.execPath);

// Spawn a command and invoke the callback when it completes with an error
// and the output from standard out.
function spawn(command, args, callback, options = {}) {
  let stdout = '';
  let spawnedProcess = null;

  try {
    spawnedProcess = ChildProcess.spawn(command, args, options);
  } catch (error) {
    // Spawn can throw an error
    setTimeout(() => callback && callback(error, stdout), 0);
    return;
  }

  spawnedProcess.stdout.on('data', (data) => {
    stdout += data;
  });

  let error = null;
  spawnedProcess.on('error', (processError) => {
    error = error || processError;
  });

  spawnedProcess.on('close', (code, signal) => {
    if (code !== 0) {
      error = error || new Error(`Command failed: ${signal || code}`);
    }
    if (error) {
      error.code = error.code || code;
      error.stdout = error.stdout || stdout;
    }
    if (callback) {
      callback(error, stdout);
    }
  });
}

// Spawn a command in detached mode without waiting for completion.
// This is used for Squirrel hooks where we need to exit quickly to avoid
// hitting Squirrel's 15-second timeout.
// See: https://github.com/Squirrel/Squirrel.Windows/issues/501
function spawnDetached(command, args) {
  try {
    const child = ChildProcess.spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (error) {
    console.error(`Failed to spawn detached process: ${command} ${args.join(' ')}`, error.message);
  }
}

// Spawn the Update.exe with the given arguments and invoke the callback when
// the command completes.
function spawnUpdate(args, callback, options = {}) {
  spawn(updateDotExe, args, callback, options);
}

function createRegistryEntries({ allowEscalation, registerDefaultIfPossible }, callback) {
  const escapeBackticks = (str) => str.replace(/\\/g, '\\\\');

  const isWindows7 = os.release().startsWith('6.1');
  const requiresLocalMachine = isWindows7;

  // On Windows 7, we must write to LOCAL_MACHINE and need escalated privileges.
  // Don't do it at install time - wait for the user to ask Mailspring to be the default.
  if (requiresLocalMachine && !allowEscalation) {
    callback();
    return;
  }

  let regPath = 'reg.exe';
  if (process.env.SystemRoot) {
    regPath = path.join(process.env.SystemRoot, 'System32', 'reg.exe');
  }

  let spawnPath = regPath;
  let spawnArgs = [];
  if (requiresLocalMachine) {
    spawnPath = path.join(appFolder, 'resources', 'elevate.cmd');
    spawnArgs = [regPath];
  }

  fs.readFile(
    path.join(appFolder, 'resources', 'mailspring-mailto-registration.reg'),
    (err, data) => {
      if (err || !data) {
        callback(err);
        return;
      }
      const importTemplate = data.toString();
      const isSquirrelInstall = fs.existsSync(updateDotExe);
      const protocolOpenCommand = isSquirrelInstall
        ? `\\\"${escapeBackticks(updateDotExe)}\\\" --processStart \\\"${exeName}\\\" --process-start-args \\\"%1\\\"`
        : `\\\"${escapeBackticks(process.execPath)}\\\" \\\"%1\\\"`;
      const appOpenCommand = isSquirrelInstall
        ? `\\\"${escapeBackticks(updateDotExe)}\\\" --processStart \\\"${exeName}\\\"`
        : `\\\"${escapeBackticks(process.execPath)}\\\"`;
      let importContents = importTemplate.replace(
        /{{PATH_TO_ROOT_FOLDER}}/g,
        escapeBackticks(rootAppDataFolder)
      );
      importContents = importContents.replace(
        /{{PATH_TO_APP_FOLDER}}/g,
        escapeBackticks(appFolder)
      );
      importContents = importContents.replace(/{{PROTOCOL_OPEN_COMMAND}}/g, protocolOpenCommand);
      importContents = importContents.replace(/{{APP_OPEN_COMMAND}}/g, appOpenCommand);
      if (requiresLocalMachine) {
        importContents = importContents.replace(/{{HKEY_ROOT}}/g, 'HKEY_LOCAL_MACHINE');
      } else {
        importContents = importContents.replace(/{{HKEY_ROOT}}/g, 'HKEY_CURRENT_USER');
      }

      const importTempPath = path.join(os.tmpdir(), `mailspring-reg-${Date.now()}.reg`);

      fs.writeFile(importTempPath, importContents, (writeErr) => {
        if (writeErr) {
          callback(writeErr);
          return;
        }

        spawn(
          spawnPath,
          spawnArgs.concat(['import', escapeBackticks(importTempPath)]),
          (spawnErr) => {
            if (isWindows7 && registerDefaultIfPossible) {
              const defaultReg = path.join(appFolder, 'resources', 'kaiyue-mailto-default.reg');
              spawn(
                spawnPath,
                spawnArgs.concat(['import', escapeBackticks(defaultReg)]),
                (spawnDefaultErr) => {
                  callback(spawnDefaultErr, true);
                }
              );
            } else {
              callback(spawnErr, false);
            }
          }
        );
      });
    }
  );
}

exports.spawn = spawnUpdate;
exports.createRegistryEntries = createRegistryEntries;

// Is the Update.exe installed with Mailspring?
exports.existsSync = () => fs.existsSync(updateDotExe);

// Register the AppUserModelId with a display name so Windows notifications
// show "Mailspring" instead of "com.squirrel.mailspring.mailspring"
// Registry path: HKEY_CURRENT_USER\SOFTWARE\Classes\AppUserModelId\{AUMID}
function registerAppUserModelId(callback) {
  const aumid = appUserModelId;
  const iconPath = path.join(appFolder, 'resources', 'kaiyue-mail.ico');

  let regPath = 'reg.exe';
  if (process.env.SystemRoot) {
    regPath = path.join(process.env.SystemRoot, 'System32', 'reg.exe');
  }

  const regKey = `HKEY_CURRENT_USER\\SOFTWARE\\Classes\\AppUserModelId\\${aumid}`;

  // Add the DisplayName value
  spawn(
    regPath,
    ['add', regKey, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', displayName, '/f'],
    (err) => {
      if (err) {
        console.warn('Failed to register AUMID DisplayName:', err);
      }
      // Also add IconUri if the icon exists
      if (fs.existsSync(iconPath)) {
        spawn(
          regPath,
          ['add', regKey, '/v', 'IconUri', '/t', 'REG_SZ', '/d', iconPath, '/f'],
          (iconErr) => {
            if (iconErr) {
              console.warn('Failed to register AUMID IconUri:', iconErr);
            }
            if (callback) callback(err || iconErr);
          }
        );
      } else {
        if (callback) callback(err);
      }
    }
  );
}

exports.registerAppUserModelId = registerAppUserModelId;

// Copy Start Menu tile visual elements (icon PNGs + manifest XML) from the
// current app-x.x.x/resources directory to the root install directory so
// Windows can display a branded tile. Errors are ignored — these are optional.
function copyVisualElements() {
  try {
    const files = [
      'mailspring-75px.png',
      'mailspring-150px.png',
      'mailspring.VisualElementsManifest.xml',
    ];
    for (const file of files) {
      fs.copyFileSync(path.join(appFolder, 'resources', file), path.join(rootAppDataFolder, file));
    }
  } catch (err) {
    // Ignore errors - visual elements are optional
  }
}

// Write shortcuts ourselves rather than relying on Squirrel's generated
// AppUserModelId. Windows associates toast notifications with the AUMID stored
// in the Start Menu shortcut, so it must exactly match app.setAppUserModelId().
// The Update.exe target remains stable across app-x.y.z upgrades.
function writeApplicationShortcuts({ includeDesktop = true } = {}) {
  if (!process.env.APPDATA) {
    console.warn('Unable to create notification shortcut because APPDATA is not set.');
    return;
  }
  const startMenuPath = path.join(
    process.env.APPDATA,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    shortcutName
  );
  const desktopPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'Desktop',
    shortcutName
  );
  const iconPath = path.join(appFolder, 'resources', 'kaiyue-mail.ico');
  const isSquirrelInstall = fs.existsSync(updateDotExe);
  const shortcutOptions = {
    target: isSquirrelInstall ? updateDotExe : process.execPath,
    args: isSquirrelInstall ? `--processStart "${exeName}"` : '',
    cwd: appFolder,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    iconIndex: 0,
    description: require('../../package.json').description,
    appUserModelId,
    toastActivatorClsid,
  };

  const shortcutPaths = includeDesktop ? [startMenuPath, desktopPath] : [startMenuPath];
  for (const shortcutPath of shortcutPaths) {
    try {
      shell.writeShortcutLink(shortcutPath, 'replace', shortcutOptions);
    } catch (err) {
      console.warn(`Failed to write application shortcut ${shortcutPath}:`, err.message);
    }
  }
}

// A Start Menu shortcut carrying the AUMID is required for reliable Windows
// Toast attribution and activation. Squirrel creates it during install; a
// portable build creates/repairs it on normal startup without adding a desktop
// shortcut.
exports.ensureNotificationShortcut = () => writeApplicationShortcuts({ includeDesktop: false });

// Restart Mailspring using the version pointed to by the Mailspring.cmd shim.
// Uses spawnDetached to ensure the child process survives the parent's exit —
// the piped-stdio `spawn` function can fail when called during `will-quit`
// because the Node.js event loop tears down the pipe before Update.exe launches
// the new app instance.
//
// Uses --processStartAndWait (not --processStart) so that Update.exe waits for
// the current instance to fully release requestSingleInstanceLock() before
// launching the new one. Without the Wait variant, the new instance can start
// before the old one exits, hit the single-instance lock, and immediately quit
// — leaving no running instance. See: https://github.com/electron/electron/pull/6037
exports.restartMailspring = (app) => {
  app.once('will-quit', () => {
    spawnDetached(updateDotExe, ['--processStartAndWait', exeName]);
  });
  app.quit();
};

// Handle --squirrel-install event with fast exit.
// Squirrel.Windows has a 15-second timeout for hooks. We spawn all necessary
// processes in detached mode and exit immediately to avoid timeout.
// See: https://github.com/Squirrel/Squirrel.Windows/issues/501
// See: https://github.com/Squirrel/Squirrel.Windows/issues/1145
exports.handleSquirrelInstall = (app) => {
  copyVisualElements();
  writeApplicationShortcuts();
  const iconPath = path.join(appFolder, 'resources', 'kaiyue-mail.ico');

  // Spawn reg.exe to register AUMID (detached - won't block exit)
  const aumid = appUserModelId;
  const regKey = `HKEY_CURRENT_USER\\SOFTWARE\\Classes\\AppUserModelId\\${aumid}`;
  let regPath = 'reg.exe';
  if (process.env.SystemRoot) {
    regPath = path.join(process.env.SystemRoot, 'System32', 'reg.exe');
  }
  spawnDetached(regPath, [
    'add',
    regKey,
    '/v',
    'DisplayName',
    '/t',
    'REG_SZ',
    '/d',
    displayName,
    '/f',
  ]);
  if (fs.existsSync(iconPath)) {
    spawnDetached(regPath, ['add', regKey, '/v', 'IconUri', '/t', 'REG_SZ', '/d', iconPath, '/f']);
  }

  // Registry entries for mailto: protocol are registered on first normal app launch
  // (via createRegistryEntries call in main.js startup). This ensures registration
  // completes even if the detached processes here don't finish before Squirrel's timeout.

  // Exit immediately - don't wait for spawned processes
  app.quit();
};

// Handle --squirrel-updated event with fast exit.
// Squirrel runs the NEW app version with this flag after extracting an update.
// We update shortcuts to point to the new version and exit immediately.
// The actual app restart happens later when the user clicks "Install Update".
exports.handleSquirrelUpdated = (app) => {
  copyVisualElements();
  writeApplicationShortcuts();

  // Exit immediately - don't wait for spawned processes
  app.quit();
};

// Handle --squirrel-uninstall event with fast exit.
exports.handleSquirrelUninstall = (app) => {
  // Spawn Update.exe to remove shortcuts (detached - won't block exit)
  spawnDetached(updateDotExe, ['--removeShortcut', exeName]);

  let regPath = 'reg.exe';
  if (process.env.SystemRoot) {
    regPath = path.join(process.env.SystemRoot, 'System32', 'reg.exe');
  }
  const registrationKeys = [
    'HKEY_CURRENT_USER\\SOFTWARE\\Classes\\kaiyuemail',
    'HKEY_CURRENT_USER\\SOFTWARE\\Classes\\KaiyueMail.Url.mailto',
    'HKEY_CURRENT_USER\\SOFTWARE\\Classes\\KaiyueMail.mailto',
    'HKEY_CURRENT_USER\\SOFTWARE\\Clients\\Mail\\KaiyueMail',
    'HKEY_CURRENT_USER\\SOFTWARE\\Clients\\Mail\\Kaiyue Mail',
  ];
  registrationKeys.forEach((key) => spawnDetached(regPath, ['delete', key, '/f']));
  ['Kaiyue Mail', 'KaiyueMail'].forEach((valueName) =>
    spawnDetached(regPath, [
      'delete',
      'HKEY_CURRENT_USER\\SOFTWARE\\RegisteredApplications',
      '/v',
      valueName,
      '/f',
    ])
  );

  // Try to remove fallback shortcuts synchronously
  const startMenuPath = path.join(
    process.env.APPDATA,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    shortcutName
  );
  const desktopPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'Desktop',
    shortcutName
  );

  try {
    if (fs.existsSync(startMenuPath)) {
      fs.unlinkSync(startMenuPath);
    }
  } catch (err) {
    // Ignore
  }

  try {
    if (fs.existsSync(desktopPath)) {
      fs.unlinkSync(desktopPath);
    }
  } catch (err) {
    // Ignore
  }

  // Exit immediately
  app.quit();
};
