import { resolveAutoUpdateFeed } from '../src/browser/autoupdate-feed';

describe('GitHub Releases update feed', () => {
  it('builds an architecture-specific feed and removes the packaged revision suffix', () => {
    expect(
      resolveAutoUpdateFeed({
        provider: 'github',
        repository: 'MelodiesZ/kaiyue-mail',
        feedUrl: 'https://update.electronjs.org/',
        platform: 'darwin',
        arch: 'arm64',
        version: '1.2.3-a1b2c3d4',
      })
    ).toBe('https://update.electronjs.org/MelodiesZ/kaiyue-mail/darwin-arm64/1.2.3');
  });

  it('supports Windows Squirrel feeds', () => {
    expect(
      resolveAutoUpdateFeed({
        provider: 'github',
        repository: 'MelodiesZ/kaiyue-mail',
        feedUrl: 'https://update.electronjs.org',
        platform: 'win32',
        arch: 'x64',
        version: '2.0.0',
      })
    ).toBe('https://update.electronjs.org/MelodiesZ/kaiyue-mail/win32-x64/2.0.0');
  });

  it('uses the signed installer manifest for Windows NSIS installations', () => {
    expect(
      resolveAutoUpdateFeed({
        provider: 'github',
        repository: 'MelodiesZ/kaiyue-mail',
        feedUrl: 'https://update.electronjs.org',
        platform: 'win32',
        arch: 'x64',
        version: '2.0.0',
        distribution: 'nsis',
      })
    ).toBe(
      'https://github.com/MelodiesZ/kaiyue-mail/releases/latest/download/kaiyue-update-win32-x64.json'
    );
  });

  it('does not configure the public Electron update service on Linux', () => {
    expect(
      resolveAutoUpdateFeed({
        provider: 'github',
        repository: 'MelodiesZ/kaiyue-mail',
        feedUrl: 'https://update.electronjs.org',
        platform: 'linux',
        arch: 'x64',
        version: '1.2.3',
      })
    ).toBe(null);
  });
});
