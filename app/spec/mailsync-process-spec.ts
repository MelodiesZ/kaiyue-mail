import * as path from 'path';
import { MailsyncProcess } from '../src/mailsync-process';

describe('MailsyncProcess', () => {
  it('runs the release sync engine from an upstream-compatible path', () => {
    const resourcePath = path.join(path.sep, 'Applications', 'Kaiyue Mail.app', 'Contents', 'Resources', 'app.asar');
    const process = new MailsyncProcess({
      configDirPath: path.join(path.sep, 'tmp', 'kaiyue-mail'),
      resourcePath,
      verbose: false,
    });

    const relativeBinary =
      global.process.platform === 'win32'
        ? path.join('mailspring-runtime', 'mailsync.exe')
        : path.join('mailspring-runtime', 'mailsync');

    expect(process.binaryPath).toBe(
      path
        .join(resourcePath, relativeBinary)
        .replace('app.asar', 'app.asar.unpacked')
    );
    expect(process.binaryPath.toLowerCase()).toContain('mailspring');
  });
});
