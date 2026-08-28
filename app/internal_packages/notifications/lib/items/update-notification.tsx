import { Actions, localized, ModalStore, React } from 'mailspring-exports';
import { ipcRenderer, shell } from 'electron';
import { Notification } from 'mailspring-component-kit';
import { CompositeDisposable } from 'event-kit';
import KaiyueConfig from '../../../../src/kaiyue-config';
import UpdateDialog, { UpdateDetails } from './update-dialog';

interface UpdateNotificationState {
  updateState: string;
  version: string;
  details: UpdateDetails;
}

export default class UpdateNotification extends React.Component<
  Record<string, unknown>,
  UpdateNotificationState
> {
  static displayName = 'UpdateNotification';

  disposable?: CompositeDisposable;
  modalUnlisten?: () => void;
  pendingDialogDetails?: UpdateDetails;
  updateDialogIsOpen = false;

  constructor(props) {
    super(props);
    this.state = this.getStateFromStores();
  }

  componentDidMount() {
    this.disposable = new CompositeDisposable(
      AppEnv.onUpdateAvailable((details) => {
        const state = this.getStateFromStores();
        this.setState(state);
        this._showUpdateDialog(details || state.details);
      }),
      AppEnv.onUpdateStateChanged((details) => {
        const nextState = details
          ? {
              updateState: details.state,
              version: details.releaseVersion,
              details,
            }
          : this.getStateFromStores();
        this.setState(nextState);
        if (
          details &&
          details.manualCheck &&
          ['checking', 'no-update-available', 'error'].includes(details.state)
        ) {
          this._showUpdateDialog(details);
        }
      })
    );
    this.modalUnlisten = ModalStore.listen(() => {
      if (ModalStore.isModalOpen()) return;
      this.updateDialogIsOpen = false;
      if (!this.pendingDialogDetails) return;
      const details = this.pendingDialogDetails;
      this.pendingDialogDetails = undefined;
      setTimeout(() => this._showUpdateDialog(details), 0);
    });
    if (['update-available', 'update-ready'].includes(this.state.updateState)) {
      this._showUpdateDialog(this.state.details);
    }
  }

  componentWillUnmount() {
    if (this.disposable) this.disposable.dispose();
    if (this.modalUnlisten) this.modalUnlisten();
  }

  getStateFromStores() {
    const updater = require('@electron/remote').getGlobal('application').autoUpdateManager;
    const updateState = updater.getState();
    const info = updater.getReleaseDetails() || {};
    return {
      updateState,
      version: info.releaseVersion,
      details: info,
    };
  }

  _showUpdateDialog = (details: UpdateDetails) => {
    if (this.updateDialogIsOpen) return;
    if (ModalStore.isModalOpen()) {
      this.pendingDialogDetails = details;
      return;
    }
    this.updateDialogIsOpen = true;
    Actions.openModal({
      component: <UpdateDialog details={details} />,
      width: 520,
      height: 520,
    });
  };

  _onUpdate = () => {
    if (this.state.updateState === 'update-ready') {
      ipcRenderer.send('command', 'application:install-update');
      return;
    }
    if (this.state.updateState === 'update-available') {
      this._showUpdateDialog(this.state.details);
      ipcRenderer.send('command', 'application:download-update');
    }
  };

  _onViewChangelog = () => {
    shell.openExternal(`https://github.com/${KaiyueConfig.updater.repository}/releases/latest`);
  };

  render() {
    const { updateState, version, details } = this.state;
    const visibleStates = ['update-available', 'downloading', 'update-ready'];

    if (!visibleStates.includes(updateState)) {
      return <span />;
    }
    const progress = details.downloadProgress
      ? Math.round(details.downloadProgress.percent || 0)
      : 0;
    const title =
      updateState === 'downloading'
        ? `正在下载凯越邮箱更新 (${progress}%)`
        : updateState === 'update-ready'
          ? localized(
              `A Kaiyue Mail update is ready %@`,
              version ? `(${version.replace('Mailspring', '').trim()})` : ''
            )
          : `发现凯越邮箱新版本${version ? ` (${version})` : ''}`;
    const actions =
      updateState === 'downloading'
        ? []
        : [
            {
              label: updateState === 'update-ready' ? localized('Install') : '查看并下载',
              fn: this._onUpdate,
            },
          ];
    return (
      <Notification
        priority="4"
        title={title}
        subtitle={localized('View changelog')}
        subtitleAction={this._onViewChangelog}
        icon="volstead-upgrade.png"
        actions={actions}
        isDismissable
      />
    );
  }
}
