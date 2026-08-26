#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const iconsetDir = path.join(
  rootDir,
  'app',
  'build',
  'resources',
  'branding',
  'KaiyueMail.iconset'
);

const pngBySize = new Map([
  [16, 'icon_16x16.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
]);

function readPng(size) {
  const filename = pngBySize.get(size);
  if (!filename) throw new Error(`No PNG configured for ${size}px`);
  return fs.readFileSync(path.join(iconsetDir, filename));
}

function writeIcns() {
  const chunks = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
  ].map(([type, size]) => {
    const png = readPng(size);
    const chunk = Buffer.alloc(8 + png.length);
    chunk.write(type, 0, 4, 'ascii');
    chunk.writeUInt32BE(chunk.length, 4);
    png.copy(chunk, 8);
    return chunk;
  });

  const output = Buffer.alloc(8 + chunks.reduce((total, chunk) => total + chunk.length, 0));
  output.write('icns', 0, 4, 'ascii');
  output.writeUInt32BE(output.length, 4);
  let offset = 8;
  for (const chunk of chunks) {
    chunk.copy(output, offset);
    offset += chunk.length;
  }

  fs.writeFileSync(
    path.join(rootDir, 'app', 'build', 'resources', 'mac', 'kaiyue-mail.icns'),
    output
  );
}

function writeIco() {
  const sizes = [16, 32, 64, 128, 256];
  const images = sizes.map(readPng);
  const headerSize = 6 + sizes.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let imageOffset = headerSize;
  sizes.forEach((size, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(images[index].length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += images[index].length;
  });

  fs.writeFileSync(
    path.join(rootDir, 'app', 'build', 'resources', 'win', 'kaiyue-mail.ico'),
    Buffer.concat([header, ...images])
  );
}

writeIcns();
writeIco();
console.log('Generated Kaiyue Mail ICNS and ICO assets.');
