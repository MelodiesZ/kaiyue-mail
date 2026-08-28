const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const assetsDirectory = path.join(
  repositoryRoot,
  'app',
  'internal_packages',
  'system-tray',
  'assets',
  'win32'
);
const iconStates = [
  'MenuItem-Inbox-Zero',
  'MenuItem-Inbox-Full',
  'MenuItem-Inbox-Full-UnreadItems',
  'MenuItem-Inbox-Full-NewItems',
];

function pngSize(filePath) {
  const png = fs.readFileSync(filePath);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('Windows tray icons use the supplied clean mail SVG at native tray sizes', () => {
  const mailSource = fs.readFileSync(path.join(assetsDirectory, 'KaiyueTray-Mail.svg'), 'utf8');
  assert.match(mailSource, /viewBox="0 0 1365 1024"/);
  assert.match(mailSource, /#1D85ED/i);

  for (const state of iconStates) {
    for (const variant of [
      { suffix: '', size: 16 },
      { suffix: '@2x', size: 32 },
    ]) {
      const lightPath = path.join(assetsDirectory, `${state}${variant.suffix}.png`);
      const darkPath = path.join(assetsDirectory, `${state}-dark${variant.suffix}.png`);
      assert.deepEqual(pngSize(lightPath), { width: variant.size, height: variant.size });
      assert.deepEqual(fs.readFileSync(darkPath), fs.readFileSync(lightPath));
    }
  }

  const full = fs.readFileSync(path.join(assetsDirectory, 'MenuItem-Inbox-Full.png'));
  const unread = fs.readFileSync(
    path.join(assetsDirectory, 'MenuItem-Inbox-Full-UnreadItems.png')
  );
  const newMail = fs.readFileSync(
    path.join(assetsDirectory, 'MenuItem-Inbox-Full-NewItems.png')
  );
  assert.notDeepEqual(unread, full);
  assert.notDeepEqual(newMail, unread);
});
