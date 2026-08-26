import { buildKaiyueNotificationUrl } from '../src/windows-notification-utils';

describe('Windows notification protocol URLs', () => {
  it('uses the registered Kaiyue protocol and safely encodes notification context', () => {
    const result = buildKaiyueNotificationUrl('notification-action', {
      id: 'notice 1',
      threadId: 'thread/中文',
      messageId: 'message@example.com',
      actionIndex: 1,
    });

    expect(result).toBe(
      'kaiyuemail://notification-action?id=notice+1&threadId=thread%2F%E4%B8%AD%E6%96%87&messageId=message%40example.com&actionIndex=1'
    );
  });
});
