export type AutoUpdateProvider = 'custom' | 'github';

interface AutoUpdateFeedOptions {
  provider: AutoUpdateProvider;
  repository: string;
  feedUrl: string;
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  id?: string;
  channel?: string;
}

function releaseVersion(version: string) {
  const match = version.match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : version;
}

export function resolveAutoUpdateFeed(options: AutoUpdateFeedOptions): string | null {
  const baseUrl = options.feedUrl.replace(/\/$/, '');

  if (options.provider === 'github') {
    if (!['darwin', 'win32'].includes(options.platform)) return null;
    return `${baseUrl}/${options.repository}/${options.platform}-${options.arch}/${releaseVersion(
      options.version
    )}`;
  }

  return `${baseUrl}/check/${options.platform}/${options.arch}/${options.version}/${
    options.id || 'anonymous'
  }/${options.channel || 'stable'}`;
}
