import { KaiyueConfig } from './kaiyue-config';

type NotificationProtocolParams = Record<string, string | number | undefined>;

/**
 * Build the protocol URL Windows uses to route toast clicks and actions back
 * into Kaiyue Mail. Keeping this in one place prevents a branded build from
 * silently falling back to Mailspring's legacy protocol registration.
 */
export function buildKaiyueNotificationUrl(
  host: 'notification-click' | 'notification-action',
  params: NotificationProtocolParams
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, `${value}`);
    }
  }
  return `${KaiyueConfig.brand.protocol}://${host}?${search.toString()}`;
}
