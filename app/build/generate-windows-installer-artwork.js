/* eslint global-require: 0 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const assetsDir = path.join(__dirname, 'windows-installer', 'assets');
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-installer-artwork-'));
const rsvgConvert = process.env.RSVG_CONVERT || 'rsvg-convert';
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const artwork = [
  { name: 'installer-sidebar', width: 492, height: 942 },
  { name: 'installer-header', width: 450, height: 171 },
];

function readBmpMetadata(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return {
    signature: bitmap.subarray(0, 2).toString('ascii'),
    width: bitmap.readInt32LE(18),
    height: Math.abs(bitmap.readInt32LE(22)),
    bitsPerPixel: bitmap.readUInt16LE(28),
  };
}

try {
  for (const asset of artwork) {
    const svgPath = path.join(assetsDir, `${asset.name}.svg`);
    const pngPath = path.join(temporaryDir, `${asset.name}.png`);
    const bmpPath = path.join(assetsDir, `${asset.name}.bmp`);

    execFileSync(
      rsvgConvert,
      ['-w', String(asset.width), '-h', String(asset.height), '-o', pngPath, svgPath],
      { cwd: assetsDir, stdio: 'inherit' }
    );
    execFileSync(
      ffmpeg,
      ['-y', '-loglevel', 'error', '-i', pngPath, '-pix_fmt', 'bgr24', bmpPath],
      {
        stdio: 'inherit',
      }
    );

    const metadata = readBmpMetadata(bmpPath);
    if (
      metadata.signature !== 'BM' ||
      metadata.width !== asset.width ||
      metadata.height !== asset.height ||
      metadata.bitsPerPixel !== 24
    ) {
      throw new Error(`Unexpected ${asset.name}.bmp metadata: ${JSON.stringify(metadata)}`);
    }
    console.log(`---> Generated ${asset.name}.bmp (${asset.width}x${asset.height}, 24-bit)`);
  }
} finally {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}
