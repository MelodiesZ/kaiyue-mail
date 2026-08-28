import defaults from '../kaiyue-config.json';

const env = process.env;

export const KaiyueConfig = Object.freeze({
  brand: Object.freeze(defaults.brand),
  mail: Object.freeze({
    domain: env.KAIYUE_MAIL_DOMAIN || defaults.mail.domain,
    host: env.KAIYUE_MAIL_HOST || defaults.mail.host,
    imapPort: Number(env.KAIYUE_IMAP_PORT || defaults.mail.imapPort),
    imapSecurity: env.KAIYUE_IMAP_SECURITY || defaults.mail.imapSecurity,
    smtpPort: Number(env.KAIYUE_SMTP_PORT || defaults.mail.smtpPort),
    smtpSecurity: env.KAIYUE_SMTP_SECURITY || defaults.mail.smtpSecurity,
  }),
  features: Object.freeze({
    ...defaults.features,
    disabledInternalPackages: Object.freeze([...defaults.features.disabledInternalPackages]),
  }),
  privacy: Object.freeze(defaults.privacy),
  services: Object.freeze({
    officialIdentityApiEnabled: env.KAIYUE_IDENTITY_API_ENABLED
      ? env.KAIYUE_IDENTITY_API_ENABLED === 'true'
      : defaults.services.officialIdentityApiEnabled,
    identityApiBaseUrl: env.KAIYUE_IDENTITY_API_BASE_URL || defaults.services.identityApiBaseUrl,
    helpUrl: env.KAIYUE_HELP_URL || defaults.services.helpUrl,
  }),
  updater: Object.freeze({
    enabled: env.KAIYUE_UPDATE_ENABLED
      ? env.KAIYUE_UPDATE_ENABLED === 'true'
      : defaults.updater.enabled,
    provider: env.KAIYUE_UPDATE_PROVIDER || defaults.updater.provider,
    repository: env.KAIYUE_UPDATE_REPOSITORY || defaults.updater.repository,
    feedUrl: env.KAIYUE_UPDATE_FEED_URL || defaults.updater.feedUrl,
    downloadBaseUrl: env.KAIYUE_UPDATE_DOWNLOAD_BASE_URL || defaults.updater.downloadBaseUrl,
  }),
  upstream: Object.freeze(defaults.upstream),
});

export function normalizeKaiyueEmail(value: string) {
  const input = `${value || ''}`.trim();
  if (!input || input.includes('@')) {
    return input;
  }
  return `${input}@${KaiyueConfig.mail.domain}`;
}

export function isKaiyueEmail(value: string) {
  const email = normalizeKaiyueEmail(value).toLowerCase();
  return email.endsWith(`@${KaiyueConfig.mail.domain.toLowerCase()}`);
}

export function buildKaiyueMessageId(uuid: string) {
  return `${uuid.trim().toUpperCase()}@${KaiyueConfig.mail.domain}`;
}

export default KaiyueConfig;
