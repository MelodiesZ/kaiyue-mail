import AutoupdateImplBase from './autoupdate-impl-base';
import { localized } from '../intl';

const { net } = require('electron');
const { NsisUpdateEngine, createElectronNetRequestStream } = require('./nsis-update-engine');

export default class AutoupdateImplWin32 extends AutoupdateImplBase {
  version: string;
  engine: InstanceType<typeof NsisUpdateEngine>;
  preparedUpdate?: {
    filePath: string;
    version: string;
    notes: string;
    sha256: string;
    size: number;
  };
  availableUpdate?: {
    version: string;
    url: string;
    notes: string;
    sha256: string;
    size: number;
  };
  pendingCheck?: Promise<void>;
  pendingDownload?: Promise<void>;

  constructor(version: string) {
    super();
    this.version = version;
    this.engine = new NsisUpdateEngine({
      requestStream: createElectronNetRequestStream(net),
    });
    this.engine.on('update-available', (update) => {
      this.availableUpdate = update;
      this.emit('update-available', {}, update);
    });
    this.engine.on('download-progress', (detail) => {
      this.emit('download-progress', {}, detail);
    });
  }

  supportsUpdates() {
    return true;
  }

  setFeedURL(feedURL: string | { url: string }) {
    super.setFeedURL(typeof feedURL === 'string' ? feedURL : feedURL.url);
  }

  checkForUpdates() {
    if (!this.feedURL || this.pendingCheck) return;

    this.emit('checking-for-update');
    this.pendingCheck = this.engine
      .check(this.feedURL, this.version)
      .then((availableUpdate) => {
        if (!availableUpdate) {
          this.emit('update-not-available');
        }
      })
      .catch(this.emitError)
      .finally(() => {
        this.pendingCheck = undefined;
      });
  }

  downloadUpdate() {
    if (!this.availableUpdate || this.pendingDownload || this.preparedUpdate) return;

    this.pendingDownload = this.engine
      .download(this.availableUpdate)
      .then((update) => {
        this.preparedUpdate = update;
        this.emit(
          'update-downloaded',
          {},
          update.notes || localized('A new version is available!'),
          update.version
        );
      })
      .catch(this.emitError)
      .finally(() => {
        this.pendingDownload = undefined;
      });
  }

  async quitAndInstall() {
    if (!this.preparedUpdate) {
      this.emitError(new Error('No verified Kaiyue Mail update is ready to install.'));
      return;
    }
    try {
      await this.engine.install(this.preparedUpdate);
      require('electron').app.quit();
    } catch (error) {
      this.emitError(error);
    }
  }
}
