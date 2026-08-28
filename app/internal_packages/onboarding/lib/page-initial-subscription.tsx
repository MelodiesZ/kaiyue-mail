import { React } from 'mailspring-exports';

const FEATURES = [
  ['统一收件', '多个企业邮箱集中管理，重要邮件清晰可见。'],
  ['高效处理', '稍后发送、稍后提醒与快捷操作随时可用。'],
  ['安全可靠', '账户配置仅保存在本机，并通过加密连接访问。'],
];

export default class InitialSubscriptionPage extends React.Component {
  static displayName = 'InitialSubscriptionPage';

  _onFinished = () => {
    require('electron').ipcRenderer.send('account-setup-successful');
  };

  render() {
    return (
      <main className="page opaque initial-subscription">
        <div className="initial-subscription__brand" aria-hidden="true">
          K
        </div>
        <p className="initial-subscription__eyebrow">凯越邮箱</p>
        <h1>邮箱工作区已准备就绪</h1>
        <p className="initial-subscription__lead">
          账户与服务器配置已经完成。现在可以在一个安静、清晰的工作区里处理所有企业邮件。
        </p>

        <div className="initial-subscription__features">
          {FEATURES.map(([title, description], index) => (
            <section className="initial-subscription__feature" key={title}>
              <span className="initial-subscription__feature-index" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </section>
          ))}
        </div>

        <button className="btn btn-large btn-primary" onClick={this._onFinished}>
          进入主邮箱
        </button>
        <p className="initial-subscription__hint">后续可在设置中继续添加或调整邮箱账户</p>
      </main>
    );
  }
}
