/* eslint global-require: 0*/
import { app, dialog, nativeImage } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { localized } from '../intl';
import KaiyueConfig from '../kaiyue-config';
import { AutoUpdateProvider, resolveAutoUpdateFeed } from './autoupdate-feed';
import WindowsUpdater from './windows-updater';

let autoUpdater = null;

const IdleState = 'idle';
const CheckingState = 'checking';
const DownloadingState = 'downloading';
const UpdateAvailableState = 'update-available';
const NoUpdateAvailableState = 'no-update-available';
const UnsupportedState = 'unsupported';
const ErrorState = 'error';
const preferredChannel = 'stable';

export default class AutoUpdateManager extends EventEmitter {
  state = IdleState;
  version: string;
  config: import('../config').default;
  specMode: boolean;
  preferredChannel: string;
  feedURL: string;
  releaseNotes: string;
  releaseVersion: string;
  installingUpdate = false;

  constructor(version: string, config: import('../config').default, specMode: boolean) {
    super();

    this.version = version;
    this.config = config;
    this.specMode = specMode;
    this.preferredChannel = preferredChannel;

    if (
      this.specMode ||
      !app.isPackaged ||
      !KaiyueConfig.updater.enabled ||
      !KaiyueConfig.updater.feedUrl
    ) {
      this.feedURL = '';
      this.setState(UnsupportedState);
      return;
    }

    this.updateFeedURL();
    if (!this.feedURL) {
      this.setState(UnsupportedState);
      return;
    }
    this.config.onDidChange('identity.id', this.updateFeedURL);

    setTimeout(() => this.setupAutoUpdater(), 0);
  }

  updateFeedURL = () => {
    if (!KaiyueConfig.updater.enabled || !KaiyueConfig.updater.feedUrl) {
      this.feedURL = '';
      return;
    }
    const params = {
      platform: process.platform,
      arch: process.arch,
      version: this.version,
      id: this.config.get('identity.id') || 'anonymous',
      channel: this.preferredChannel,
      distribution:
        process.platform === 'win32' && !WindowsUpdater.existsSync()
          ? ('nsis' as const)
          : undefined,
    };

    // If we're on the x64 Mac build, but the machine has an Apple-branded
    // processor, switch the user to the arm64 build.
    if (params.platform === 'darwin' && process.arch === 'x64') {
      const cpus = os.cpus();
      if (cpus.length && cpus[0].model.startsWith('Apple ')) {
        params.arch = 'arm64';
      }
    }

    this.feedURL =
      resolveAutoUpdateFeed({
        provider: KaiyueConfig.updater.provider as AutoUpdateProvider,
        repository: KaiyueConfig.updater.repository,
        feedUrl: KaiyueConfig.updater.feedUrl,
        ...params,
      }) || '';
    if (autoUpdater) {
      this.setAutoUpdaterFeedURL();
    }
  };

  setupAutoUpdater() {
    if (process.platform === 'linux') {
      const Impl = require('./autoupdate-impl-base').default;
      autoUpdater = new Impl();
    } else if (process.platform === 'win32' && !WindowsUpdater.existsSync()) {
      const Impl = require('./autoupdate-impl-win32').default;
      autoUpdater = new Impl(this.version);
    } else {
      autoUpdater = require('electron').autoUpdater;
    }

    autoUpdater.on('error', (error) => {
      if (this.specMode) return;
      console.error(`Error Downloading Update: ${error.message}`);
      this.setState(ErrorState);
      if (this.installingUpdate) {
        dialog.showMessageBox({
          type: 'warning',
          buttons: [localized('OK')],
          icon: this.dialogIcon(),
          message: localized('There was an error installing the update.'),
          title: localized('Update Error'),
          detail: error.message,
        });
      }
    });

    this.setAutoUpdaterFeedURL();

    autoUpdater.on('checking-for-update', () => {
      this.setState(CheckingState);
    });

    autoUpdater.on('update-not-available', () => {
      this.setState(NoUpdateAvailableState);
    });

    autoUpdater.on('update-available', () => {
      this.setState(DownloadingState);
    });

    autoUpdater.on(
      'update-downloaded',
      (_event: Electron.Event, releaseNotes: string, releaseVersion: string) => {
        this.releaseNotes = releaseNotes;
        this.releaseVersion = releaseVersion;
        this.setState(UpdateAvailableState);
        this.emitUpdateAvailableEvent();
      }
    );

    if (autoUpdater.supportsUpdates && !autoUpdater.supportsUpdates()) {
      this.setState(UnsupportedState);
      return;
    }

    //check immediately at startup
    this.check({ hidePopups: true });

    //check every 30 minutes
    setInterval(
      () => {
        if ([UpdateAvailableState, UnsupportedState].includes(this.state)) {
          console.log('Skipping update check... update ready to install, or updater unavailable.');
          return;
        }
        this.check({ hidePopups: true });
      },
      1000 * 60 * 30
    );
  }

  setAutoUpdaterFeedURL() {
    if (!autoUpdater || !this.feedURL) return;
    if (process.platform === 'darwin' || process.platform === 'win32') {
      autoUpdater.setFeedURL({ url: this.feedURL });
    } else {
      autoUpdater.setFeedURL(this.feedURL);
    }
  }

  emitUpdateAvailableEvent() {
    if (!this.releaseVersion) {
      return;
    }
    global.application.windowManager.sendToAllWindows(
      'update-available',
      {},
      this.getReleaseDetails()
    );
  }

  setState(state: string) {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.emit('state-changed', this.state);
  }

  getState() {
    return this.state;
  }

  getReleaseDetails() {
    return {
      releaseVersion: this.releaseVersion,
      releaseNotes: this.releaseNotes,
    };
  }

  check({ hidePopups }: { hidePopups?: boolean } = {}) {
    if (!autoUpdater || !this.feedURL) return;
    this.updateFeedURL();
    if (!hidePopups) {
      autoUpdater.once('update-not-available', this.onUpdateNotAvailable);
      autoUpdater.once('error', this.onUpdateError);
    }
    autoUpdater.checkForUpdates();
  }

  install() {
    if (!autoUpdater) return;
    this.installingUpdate = true;
    try {
      const result = autoUpdater.quitAndInstall();
      if (result && typeof result.finally === 'function') {
        result
          .finally(() => {
            this.installingUpdate = false;
          })
          .catch(() => {});
      }
    } catch (error) {
      this.installingUpdate = false;
      throw error;
    }
  }

  dialogIcon() {
    const iconPath = path.join(
      global.application.resourcePath,
      'static',
      'images',
      'mailspring.png'
    );
    if (!fs.existsSync(iconPath)) return undefined;
    return nativeImage.createFromPath(iconPath);
  }

  onUpdateNotAvailable = () => {
    autoUpdater.removeListener('error', this.onUpdateError);
    dialog.showMessageBox({
      type: 'info',
      buttons: [localized('OK')],
      icon: this.dialogIcon(),
      message: localized('No update available.'),
      title: localized('No update available.'),
      detail: localized(`您正在使用最新版本的凯越邮箱 (%@)。`, this.version),
    });
  };

  onUpdateError = (event: Electron.Event, message: string) => {
    autoUpdater.removeListener('update-not-available', this.onUpdateNotAvailable);
    dialog.showMessageBox({
      type: 'warning',
      buttons: [localized('OK')],
      icon: this.dialogIcon(),
      message: localized('There was an error checking for updates.'),
      title: localized('Update Error'),
      detail: message,
    });
  };
}
