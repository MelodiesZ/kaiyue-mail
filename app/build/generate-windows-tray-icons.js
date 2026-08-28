/* eslint global-require: 0 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const assetsDir = path.join(
  __dirname,
  '..',
  'internal_packages',
  'system-tray',
  'assets',
  'win32'
);
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-windows-tray-'));
const rsvgConvert = process.env.RSVG_CONVERT || 'rsvg-convert';
const iconStates = [
  { source: 'KaiyueTray-Zero.svg', output: 'MenuItem-Inbox-Zero' },
  { source: 'KaiyueTray-Full.svg', output: 'MenuItem-Inbox-Full' },
  { source: 'KaiyueTray-Unread.svg', output: 'MenuItem-Inbox-Full-UnreadItems' },
  { source: 'KaiyueTray-New.svg', output: 'MenuItem-Inbox-Full-NewItems' },
];
const sizes = [
  { pixels: 16, suffix: '' },
  { pixels: 32, suffix: '@2x' },
];

function readPngSize(filePath) {
  const png = fs.readFileSync(filePath);
  if (png.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error(`Tray icon is not a PNG: ${filePath}`);
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

try {
  for (const state of iconStates) {
    for (const size of sizes) {
      const filename = `${state.output}${size.suffix}.png`;
      const temporaryPath = path.join(temporaryDir, filename);
      execFileSync(
        rsvgConvert,
        [
          '-w',
          String(size.pixels),
          '-h',
          String(size.pixels),
          '-o',
          temporaryPath,
          path.join(assetsDir, state.source),
        ],
        { cwd: assetsDir, stdio: 'inherit' }
      );
      const metadata = readPngSize(temporaryPath);
      if (metadata.width !== size.pixels || metadata.height !== size.pixels) {
        throw new Error(`Unexpected tray icon dimensions: ${filename}`);
      }
      fs.copyFileSync(temporaryPath, path.join(assetsDir, filename));
      fs.copyFileSync(
        temporaryPath,
        path.join(assetsDir, `${state.output}-dark${size.suffix}.png`)
      );
    }
  }
  console.log('---> Generated Kaiyue Mail Windows tray icons (16px and 32px)');
} finally {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}
