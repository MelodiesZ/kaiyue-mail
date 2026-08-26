import { Account } from './flux/models/account';
import KaiyueConfig, { normalizeKaiyueEmail } from './kaiyue-config';

export function buildKaiyueAccount(emailInput: string, password: string) {
  const emailAddress = normalizeKaiyueEmail(emailInput);
  const username = emailAddress;
  const name = emailAddress.split('@')[0];

  return new Account({
    name,
    emailAddress,
    provider: 'imap',
    settings: {
      imap_host: KaiyueConfig.mail.host,
      imap_port: KaiyueConfig.mail.imapPort,
      imap_username: username,
      imap_password: password,
      imap_security: KaiyueConfig.mail.imapSecurity,
      imap_allow_insecure_ssl: false,
      smtp_host: KaiyueConfig.mail.host,
      smtp_port: KaiyueConfig.mail.smtpPort,
      smtp_username: username,
      smtp_password: password,
      smtp_security: KaiyueConfig.mail.smtpSecurity,
      smtp_allow_insecure_ssl: false,
      container_folder: KaiyueConfig.brand.helperFolderName,
    },
  });
}
