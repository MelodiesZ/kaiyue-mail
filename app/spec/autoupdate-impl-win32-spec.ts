import AutoupdateImplWin32 from '../src/browser/autoupdate-impl-win32';

describe('Windows NSIS updater adapter', () => {
  it('accepts Electron setFeedURL options and stores the URL string', () => {
    const updater = new AutoupdateImplWin32('1.0.2');
    updater.setFeedURL({
      url: 'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json',
    });

    expect(updater.feedURL).toBe(
      'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json'
    );
  });
});
