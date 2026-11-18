import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'capture.mjs'];
// Deterministic, uncompressed ZIP with an explicit source allowlist.
const entries = [], directory = [];
let offset = 0;
for (const name of files) {
  const filename = Buffer.from(name), data = readFileSync(resolve(root, 'extensions/chrome', name));
  const checksum = crc32(data), header = Buffer.alloc(30), central = Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12); // 1980-01-01
  header.writeUInt32LE(checksum, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(33, 14); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  entries.push(header, filename, data); directory.push(central, filename);
  offset += header.length + filename.length + data.length;
}
const centralDirectory = Buffer.concat(directory), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...entries, centralDirectory, end]);
const destination = resolve(root, 'public/downloads/tav-chrome-extension.zip');
if (process.argv.includes('--check')) {
  if (!readFileSync(destination).equals(archive)) throw new Error('Extension package is stale. Run npm run package:extension.');
  console.log('Extension package matches the five allowlisted source files.');
} else {
  mkdirSync(resolve(root, 'public/downloads'), { recursive: true });
  writeFileSync(destination, archive);
  console.log('Packaged public/downloads/tav-chrome-extension.zip');
}
