import { localized, React } from 'mailspring-exports';
import * as OnboardingActions from './onboarding-actions';
import KaiyueConfig from '../../../src/kaiyue-config';

export default class WelcomePage extends React.Component {
  static displayName = 'WelcomePage';

  _onContinue = () => {
    OnboardingActions.moveToPage('tutorial');
  };

  render() {
    return (
      <div className="page welcome">
        <div className="steps-container">
          <div className="welcome-brand">
            <span className="welcome-mark" aria-hidden="true">
              K
            </span>
            <h1 className="hero-text">{localized('欢迎使用凯越邮箱')}</h1>
            <p className="sub-text">{KaiyueConfig.brand.company}</p>
          </div>
        </div>
        <div className="footer">
          <button key="next" className="btn btn-large btn-continue" onClick={this._onContinue}>
            {localized('开始使用')}
          </button>
        </div>
      </div>
    );
  }
}
