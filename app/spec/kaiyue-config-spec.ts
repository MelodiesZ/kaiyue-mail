import {
  buildKaiyueMessageId,
  isKaiyueEmail,
  KaiyueConfig,
  normalizeKaiyueEmail,
} from '../src/kaiyue-config';
import { buildKaiyueAccount } from '../src/kaiyue-account-config';
import { rootURLForServer } from '../src/flux/mailspring-api-request';
import { localized } from '../src/intl';
import configSchema from '../src/config-schema';
import { isKaiyueDisabledPackage } from '../src/package-manager';
import appPackage from '../package.json';

describe('KaiyueConfig', () => {
  it('completes a bare mailbox name with the enterprise domain', () => {
    expect(normalizeKaiyueEmail(' leipeng ')).toBe('leipeng@kaiyuedrill.com');
  });

  it('does not rewrite a complete external email address', () => {
    expect(normalizeKaiyueEmail('person@example.net')).toBe('person@example.net');
    expect(isKaiyueEmail('person@example.net')).toBe(false);
  });

  it('uses the enterprise domain for outbound Message-IDs', () => {
    expect(buildKaiyueMessageId(' 9c24a6f5-2fe5 ')).toBe('9C24A6F5-2FE5@kaiyuedrill.com');
  });

  it('builds the verified Mailcow connection settings without persisting a test secret', () => {
    const account = buildKaiyueAccount('leipeng', 'runtime-password');

    expect(account.emailAddress).toBe('leipeng@kaiyuedrill.com');
    expect(account.provider).toBe('imap');
    expect(account.settings.imap_host).toBe('mail.kaiyuedrill.com');
    expect(account.settings.imap_port).toBe(993);
    expect(account.settings.imap_security).toBe('SSL / TLS');
    expect(account.settings.smtp_port).toBe(587);
    expect(account.settings.smtp_security).toBe('STARTTLS');
    expect(account.settings.container_folder).toBe(KaiyueConfig.brand.helperFolderName);
    expect(account.settings.imap_password).toBe('runtime-password');
    expect(JSON.stringify(KaiyueConfig)).not.toContain('password');
  });

  it('blocks the upstream identity service by default', () => {
    expect(KaiyueConfig.services.officialIdentityApiEnabled).toBe(false);
    expect(() => rootURLForServer('identity')).toThrow(
      'The official Mailspring identity service is disabled in Kaiyue Mail.'
    );
  });

  it('applies Kaiyue branding to inherited localized copy', () => {
    expect(localized('Mailspring is ready')).toContain(KaiyueConfig.brand.name);
    expect(localized('Mailspring is ready')).not.toContain('Mailspring');
  });

  it('defaults normal application sessions to Simplified Chinese', () => {
    expect(configSchema.core.properties.intl.properties.language.default).toBe('zh-CN');
  });

  it('cannot activate upstream cloud feature packages', () => {
    const cloudPackages = [
      'activity',
      'composer-grammar-check',
      'link-tracking',
      'open-tracking',
      'participant-profile',
      'thread-sharing',
      'translation',
    ];

    expect(KaiyueConfig.features.disabledInternalPackages).toEqual(cloudPackages);
    for (const packageName of cloudPackages) {
      expect(isKaiyueDisabledPackage(packageName)).toBe(true);
    }
    expect(isKaiyueDisabledPackage('composer')).toBe(false);
  });

  it('ships independent application metadata', () => {
    expect(appPackage.name).toBe('kaiyue-mail');
    expect(appPackage.productName).toBe(KaiyueConfig.brand.name);
    expect(appPackage.version).toBe('1.0.0');
  });
});
