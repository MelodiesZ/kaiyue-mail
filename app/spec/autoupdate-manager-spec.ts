import AutoUpdateManager from '../src/browser/autoupdate-manager';

describe('AutoUpdateManager', function () {
  beforeEach(function () {
    this.mailspringIdentityId = null;
    this.specMode = true;
    this.config = {
      set: jasmine.createSpy('config.set'),
      get: (key) => {
        if (key === 'identity.id') {
          return this.mailspringIdentityId;
        }
        if (key === 'env') {
          return 'production';
        }
      },
      onDidChange: (key, callback) => {
        return callback();
      },
    };
  });

  it('keeps official Mailspring updates disabled until a Kaiyue feed is configured', function () {
    const m = new AutoUpdateManager('1.0.0', this.config, this.specMode);
    expect(m.feedURL).toEqual('');
    expect(m.getState()).toEqual('unsupported');
  });
});
