/* eslint global-require: 0*/
import { app } from 'electron';
import { EventEmitter } from 'events';
import os from 'os';
import { localized } from '../intl';
import KaiyueConfig from '../kaiyue-config';
import { AutoUpdateProvider, resolveAutoUpdateFeed } from './autoupdate-feed';
import WindowsUpdater from './windows-updater';

let autoUpdater = null;

const IdleState = 'idle';
const CheckingState = 'checking';
const DownloadingState = 'downloading';
const UpdateAvailableState = 'update-available';
const UpdateReadyState = 'update-ready';
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
  feedURLs: string[] = [];
  releaseNotes: string;
  releaseVersion: string;
  downloadProgress = { percent: 0, transferred: 0, total: 0 };
  updateError = '';
  installingUpdate = false;
  manualCheck = false;

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
      this.feedURLs = [];
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

    const resolvedFeed = resolveAutoUpdateFeed({
      provider: KaiyueConfig.updater.provider as AutoUpdateProvider,
      repository: KaiyueConfig.updater.repository,
      feedUrl: KaiyueConfig.updater.feedUrl,
      downloadBaseUrl: KaiyueConfig.updater.downloadBaseUrl,
      ...params,
    });
    this.feedURLs = resolvedFeed
      ? Array.isArray(resolvedFeed)
        ? resolvedFeed
        : [resolvedFeed]
      : [];
    this.feedURL = this.feedURLs[0] || '';
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
      this.updateError = error.message;
      this.setState(ErrorState);
      this.emitUpdateStateEvent();
    });

    this.setAutoUpdaterFeedURL();

    autoUpdater.on('checking-for-update', () => {
      this.setState(CheckingState);
      this.emitUpdateStateEvent();
    });

    autoUpdater.on('update-not-available', () => {
      this.setState(NoUpdateAvailableState);
      this.emitUpdateStateEvent();
    });

    autoUpdater.on('update-available', (_event, update) => {
      if (update && typeof update === 'object' && update.version) {
        this.releaseNotes = update.notes || localized('A new version is available!');
        this.releaseVersion = update.version;
        this.downloadProgress = { percent: 0, transferred: 0, total: update.size || 0 };
        this.setState(UpdateAvailableState);
        this.emitUpdateAvailableEvent();
        this.emitUpdateStateEvent();
        return;
      }
      this.setState(DownloadingState);
    });

    autoUpdater.on('download-progress', (_event, detail) => {
      this.downloadProgress = {
        percent: detail.percent || 0,
        transferred: detail.transferred || 0,
        total: detail.total || 0,
      };
      this.setState(DownloadingState);
      this.emitUpdateStateEvent();
    });

    autoUpdater.on(
      'update-downloaded',
      (_event: Electron.Event, releaseNotes: string, releaseVersion: string) => {
        this.releaseNotes = releaseNotes;
        this.releaseVersion = releaseVersion;
        this.downloadProgress = {
          percent: 100,
          transferred: this.downloadProgress.total,
          total: this.downloadProgress.total,
        };
        this.setState(UpdateReadyState);
        this.emitUpdateAvailableEvent();
        this.emitUpdateStateEvent();
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
        if ([UpdateAvailableState, UpdateReadyState, UnsupportedState].includes(this.state)) {
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
    if (process.platform === 'win32' && !WindowsUpdater.existsSync()) {
      autoUpdater.setFeedURL(this.feedURLs);
    } else if (process.platform === 'darwin' || process.platform === 'win32') {
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

  emitUpdateStateEvent() {
    global.application.windowManager.sendToAllWindows(
      'update-state-changed',
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
      state: this.state,
      releaseVersion: this.releaseVersion,
      releaseNotes: this.releaseNotes,
      downloadProgress: this.downloadProgress,
      error: this.updateError,
      currentVersion: this.version,
      manualCheck: this.manualCheck,
    };
  }

  check({ hidePopups }: { hidePopups?: boolean } = {}) {
    this.manualCheck = !hidePopups;
    this.updateError = '';
    if (!autoUpdater || !this.feedURL) {
      if (this.manualCheck) {
        this.updateError = '更新服务暂时不可用，请稍后重试。';
        this.setState(ErrorState);
        this.emitUpdateStateEvent();
      }
      return;
    }
    this.updateFeedURL();
    if (this.manualCheck) {
      // Give explicit checks immediate UI feedback. Some providers perform
      // network setup before emitting their own `checking-for-update` event.
      this.setState(CheckingState);
      this.emitUpdateStateEvent();
    }
    autoUpdater.checkForUpdates();
  }

  download() {
    if (!autoUpdater || this.state !== UpdateAvailableState) return;
    if (typeof autoUpdater.downloadUpdate !== 'function') return;
    this.manualCheck = false;
    this.setState(DownloadingState);
    this.emitUpdateStateEvent();
    autoUpdater.downloadUpdate();
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
}
