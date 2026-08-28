import { Actions, localized, React } from 'mailspring-exports';
import { ipcRenderer } from 'electron';
import { Disposable } from 'event-kit';

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateDetails {
  state: string;
  releaseVersion?: string;
  releaseNotes?: string;
  downloadProgress?: UpdateProgress;
  error?: string;
  currentVersion?: string;
  manualCheck?: boolean;
}

interface UpdateDialogProps {
  details: UpdateDetails;
}

function normalizeDetails(details: UpdateDetails): UpdateDetails {
  return {
    state: details.state || 'update-available',
    releaseVersion: details.releaseVersion || '',
    releaseNotes: details.releaseNotes || localized('A new version is available!'),
    downloadProgress: details.downloadProgress || { percent: 0, transferred: 0, total: 0 },
    error: details.error || '',
    currentVersion: details.currentVersion || '',
    manualCheck: Boolean(details.manualCheck),
  };
}

export function formatUpdateBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

export default class UpdateDialog extends React.Component<UpdateDialogProps, UpdateDetails> {
  disposable?: Disposable;

  constructor(props: UpdateDialogProps) {
    super(props);
    this.state = normalizeDetails(props.details);
  }

  componentDidMount() {
    this.disposable = AppEnv.onUpdateStateChanged((details) => {
      this.setState(normalizeDetails(details));
    });
  }

  componentWillUnmount() {
    if (this.disposable) this.disposable.dispose();
  }

  _onDownload = () => {
    ipcRenderer.send('command', 'application:download-update');
  };

  _onInstall = () => {
    ipcRenderer.send('command', 'application:install-update');
  };

  _onCheckAgain = () => {
    ipcRenderer.send('command', 'application:check-for-update');
  };

  _onLater = () => {
    Actions.closeModal();
  };

  renderActions() {
    const { state } = this.state;
    if (state === 'checking') {
      return null;
    }
    if (state === 'no-update-available') {
      return (
        <div className="update-dialog-actions update-dialog-actions-centered">
          <button type="button" className="btn btn-emphasis" onClick={this._onLater}>
            好的
          </button>
        </div>
      );
    }
    if (state === 'downloading') {
      return (
        <div className="update-dialog-actions">
          <button type="button" className="btn" onClick={this._onLater}>
            {localized('Hide')}
          </button>
        </div>
      );
    }
    if (state === 'update-ready') {
      return (
        <div className="update-dialog-actions">
          <button type="button" className="btn" onClick={this._onLater}>
            稍后安装
          </button>
          <button type="button" className="btn btn-emphasis" onClick={this._onInstall}>
            立即安装并重启
          </button>
        </div>
      );
    }
    if (state === 'error') {
      return (
        <div className="update-dialog-actions">
          <button type="button" className="btn" onClick={this._onLater}>
            关闭
          </button>
          <button type="button" className="btn btn-emphasis" onClick={this._onCheckAgain}>
            重新检查
          </button>
        </div>
      );
    }
    return (
      <div className="update-dialog-actions">
        <button type="button" className="btn" onClick={this._onLater}>
          稍后提醒
        </button>
        <button type="button" className="btn btn-emphasis" onClick={this._onDownload}>
          下载更新
        </button>
      </div>
    );
  }

  render() {
    const { state, releaseVersion, releaseNotes, downloadProgress, error, currentVersion } =
      this.state;
    const progress = Math.max(0, Math.min(100, downloadProgress.percent || 0));
    const isChecking = state === 'checking';
    const isLatest = state === 'no-update-available';
    const isDownloading = state === 'downloading';
    const isReady = state === 'update-ready';
    const isError = state === 'error';
    const hasStartedDownloading = isDownloading && downloadProgress.transferred > 0;
    const title = isChecking
      ? '正在检查更新'
      : isLatest
        ? '已是最新版本'
        : isDownloading
          ? '正在下载更新'
          : isReady
            ? '更新已准备好'
            : isError
              ? '检查更新失败'
              : '发现凯越邮箱新版本';
    const compact = isChecking || isLatest || isError;

    return (
      <section
        className={`kaiyue-update-dialog state-${state}${compact ? ' is-compact' : ''}`}
        aria-labelledby="kaiyue-update-title"
        aria-live="polite"
        aria-busy={isChecking}
      >
        <div
          className={`update-dialog-brand-mark${isChecking ? ' is-checking' : ''}`}
          aria-hidden="true"
        >
          <span>K</span>
        </div>
        <div className="update-dialog-heading">
          <h2 id="kaiyue-update-title">{title}</h2>
          {releaseVersion && <span className="update-dialog-version">版本 {releaseVersion}</span>}
        </div>

        {isChecking && (
          <div className="update-dialog-checking-status">
            <span className="update-dialog-spinner" aria-hidden="true" />
            <div>
              <strong>正在连接凯越更新服务</strong>
              <span>正在安全检查新版本，请稍候…</span>
            </div>
          </div>
        )}

        {isLatest && (
          <div className="update-dialog-latest-result">
            <span className="update-dialog-result-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>凯越邮箱已是最新版本</strong>
              <span>当前版本 {currentVersion || '已安装版本'}，暂无可用更新。</span>
            </div>
          </div>
        )}

        {!isChecking && !isLatest && !isError && (
          <div className="update-dialog-notes">
            <div className="update-dialog-section-label">更新说明</div>
            <div className="update-dialog-notes-content">{releaseNotes}</div>
          </div>
        )}

        {isDownloading && (
          <div className="update-dialog-download">
            <div className="update-dialog-progress-copy">
              <span>
                {hasStartedDownloading ? '正在下载并同步校验安装包' : '正在连接下载服务器…'}
              </span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <div
              className={`update-dialog-progress-track ${
                hasStartedDownloading ? '' : 'indeterminate'
              }`}
              role="progressbar"
              aria-label="更新下载进度"
              aria-busy={!hasStartedDownloading}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div className="update-dialog-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="update-dialog-progress-size">
              <span>
                {hasStartedDownloading
                  ? `已下载 ${formatUpdateBytes(downloadProgress.transferred)}`
                  : '正在建立安全连接'}
              </span>
              <span>共 {formatUpdateBytes(downloadProgress.total)}</span>
            </div>
          </div>
        )}

        {isReady && (
          <div className="update-dialog-status success">
            下载与安全校验已完成。安装时凯越邮箱会自动重启。
          </div>
        )}

        {isError && (
          <div className="update-dialog-status error">
            <strong>未能完成检查</strong>
            <span>{error || '请检查网络连接后重新尝试。'}</span>
          </div>
        )}

        {this.renderActions()}
      </section>
    );
  }
}
