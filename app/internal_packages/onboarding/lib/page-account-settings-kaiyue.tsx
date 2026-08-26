import React from 'react';
import { localized, Account, RegExpUtils } from 'mailspring-exports';

import KaiyueConfig, { isKaiyueEmail, normalizeKaiyueEmail } from '../../../src/kaiyue-config';
import { buildKaiyueAccount } from '../../../src/kaiyue-account-config';
import * as OnboardingActions from './onboarding-actions';
import CreatePageForForm from './decorators/create-page-for-form';
import { expandAccountWithCommonSettings } from './onboarding-helpers';
import FormField from './form-field';

interface KaiyueAccountSettingsFormProps {
  account: Account;
  errorFieldNames: string[];
  submitting: boolean;
  onConnect: (account: Account) => void;
  onFieldChange: () => void;
  onFieldKeyPress: () => void;
}

class KaiyueAccountSettingsForm extends React.Component<KaiyueAccountSettingsFormProps> {
  static displayName = 'KaiyueAccountSettingsForm';
  static hideBackButton = true;

  static submitLabel = () => localized('登录');
  static titleLabel = () => KaiyueConfig.brand.nameChinese;
  static subtitleLabel = () => localized('输入企业邮箱和密码，服务器参数将自动配置。');

  static validateAccount = (account: Account) => {
    const errorFieldNames: string[] = [];
    let errorMessage: string = null;
    const input = `${account.emailAddress || ''}`.trim();
    const password = account.settings.imap_password;

    if (!input || !password) {
      return { errorMessage, errorFieldNames, populated: false };
    }

    const normalized = normalizeKaiyueEmail(input);
    if (!RegExpUtils.emailRegex().test(normalized)) {
      errorFieldNames.push('emailAddress');
      errorMessage = localized('请输入有效的邮箱地址或用户名。');
    }

    return { errorMessage, errorFieldNames, populated: true };
  };

  async submit() {
    const emailInput = this.props.account.emailAddress;
    const password = this.props.account.settings.imap_password;
    let account: Account;

    if (isKaiyueEmail(emailInput)) {
      account = buildKaiyueAccount(emailInput, password);
    } else {
      const emailAddress = normalizeKaiyueEmail(emailInput);
      account = new Account({
        name: emailAddress.split('@')[0],
        emailAddress,
        provider: 'imap',
        settings: { imap_password: password },
      });
      account = await expandAccountWithCommonSettings(account);
    }

    OnboardingActions.setAccount(account);
    if (account.settings.imap_host && account.settings.smtp_host) {
      this.props.onConnect(account);
    } else {
      OnboardingActions.moveToPage('account-settings-imap');
    }
  }

  render() {
    return (
      <form className="settings kaiyue-login-form">
        <div className="kaiyue-wordmark" aria-label={KaiyueConfig.brand.name}>
          <span className="kaiyue-mark" aria-hidden="true">
            K
          </span>
          <div>
            <strong>{KaiyueConfig.brand.name}</strong>
            <small>{KaiyueConfig.brand.company}</small>
          </div>
        </div>
        <FormField field="emailAddress" title={localized('邮箱')} {...this.props} />
        <div className="kaiyue-field-hint">
          {localized('可只输入用户名，自动补全')} @{KaiyueConfig.mail.domain}
        </div>
        <FormField
          field="settings.imap_password"
          title={localized('密码')}
          type="password"
          {...this.props}
        />
        {KaiyueConfig.features.allowOtherMailProviders && (
          <button
            type="button"
            className="kaiyue-other-account"
            onClick={() => OnboardingActions.moveToPage('account-choose')}
          >
            {localized('添加其他邮箱')}
          </button>
        )}
      </form>
    );
  }
}

export default CreatePageForForm(KaiyueAccountSettingsForm);
