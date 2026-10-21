/* Create a small, self-contained BrowsEye Windows icon without external tools. */
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

const output = path.resolve(process.argv[2] || 'build/icon.ico');
const size = 256;
const pixels = Buffer.alloc(size * size * 4);

function pixel(x, y, color, opacity = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (Math.floor(y) * size + Math.floor(x)) * 4;
  const alpha = Math.max(0, Math.min(1, opacity));
  pixels[index] = Math.round(pixels[index] * (1 - alpha) + color[0] * alpha);
  pixels[index + 1] = Math.round(pixels[index + 1] * (1 - alpha) + color[1] * alpha);
  pixels[index + 2] = Math.round(pixels[index + 2] * (1 - alpha) + color[2] * alpha);
  pixels[index + 3] = 255;
}

function circle(cx, cy, radius, color, inner = 0) {
  const outer2 = radius * radius;
  const inner2 = inner * inner;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const distance2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (distance2 <= outer2 && distance2 >= inner2) pixel(x, y, color);
    }
  }
}

function ellipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pixel(x, y, color);
    }
  }
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0); name.copy(header, 4);
  const footer = Buffer.alloc(4); footer.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([header, data, footer]);
}

function makePng() {
  const background = [16, 32, 38];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixel(x, y, background);
  circle(128, 128, 111, [55, 105, 96], 107);
  ellipse(128, 128, 92, 57, [180, 239, 208]);
  ellipse(128, 128, 78, 43, [16, 32, 38]);
  circle(128, 128, 35, [142, 217, 186]);
  circle(128, 128, 17, [16, 32, 38]);
  circle(141, 115, 8, [232, 255, 243]);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    rows[row] = 0;
    pixels.copy(rows, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  const png = makePng();
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // icon
  icoHeader.writeUInt16LE(1, 4); // one image
  icoHeader.writeUInt8(0, 6); // 0 encodes 256 pixels
  icoHeader.writeUInt8(0, 7);
  icoHeader.writeUInt8(0, 8);
  icoHeader.writeUInt8(0, 9);
  icoHeader.writeUInt16LE(1, 10);
  icoHeader.writeUInt16LE(32, 12);
  icoHeader.writeUInt32LE(png.length, 14);
  icoHeader.writeUInt32LE(22, 18);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, Buffer.concat([icoHeader, png]));
  await writeFile(path.join(path.dirname(output), `${path.basename(output, path.extname(output))}.png`), png);
  console.log(`BrowsEye-Symbol erzeugt: ${output}`);
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
