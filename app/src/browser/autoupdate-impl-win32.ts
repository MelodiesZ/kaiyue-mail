import AutoupdateImplBase from './autoupdate-impl-base';
import { localized } from '../intl';

const { NsisUpdateEngine } = require('./nsis-update-engine');

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
  pendingCheck?: Promise<void>;

  constructor(version: string) {
    super();
    this.version = version;
    this.engine = new NsisUpdateEngine();
    this.engine.on('update-available', () => this.emit('update-available'));
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
      .prepare(this.feedURL, this.version)
      .then((update) => {
        if (!update) {
          this.emit('update-not-available');
          return;
        }
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
        this.pendingCheck = undefined;
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
