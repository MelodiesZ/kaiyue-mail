import { Account, MailsyncProcess } from 'mailspring-exports';

import { finalizeAndValidateAccount } from '../lib/onboarding-helpers';

describe('Account validation', () => {
  it('authenticates with SMTP without sending a test email', async () => {
    const account = new Account({
      emailAddress: 'person@example.com',
      provider: 'imap',
      settings: {
        imap_host: 'imap.example.com',
        imap_port: 993,
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        container_folder: 'Mailspring',
      },
    });
    let validatedAccount: Account = null;

    spyOn(MailsyncProcess.prototype, 'test').andCallFake(function testWithoutSpawning() {
      validatedAccount = this.account;
      return Promise.resolve();
    });

    await finalizeAndValidateAccount(account);

    expect(validatedAccount).toBe(account);
    expect(account.settings.smtp_verification).toBe('login');
    expect(account.settings.container_folder).toBe('Mailspring');
  });
});
