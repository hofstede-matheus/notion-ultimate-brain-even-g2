/**
 * 1-bit monochrome BMP encoder for the G2. BMP, not PNG: a 1-bit PNG renders
 * solid green on G2 firmware, while a 1-bit BMP decodes correctly through
 * the SDK's `updateImageRawData` -> gray4 path.
 */

const FILE_HEADER_SIZE = 14;
const DIB_HEADER_SIZE = 40;
const COLOR_TABLE_SIZE = 8; // 2 colors × 4 bytes (BGRA)
const HEADER_SIZE = FILE_HEADER_SIZE + DIB_HEADER_SIZE + COLOR_TABLE_SIZE; // 62 bytes
const PIXELS_PER_METER = 2835; // 72 DPI

function rowBytes(width: number): number {
  return Math.ceil(width / 8);
}

function rowStride(width: number): number {
  return Math.ceil(rowBytes(width) / 4) * 4;
}

export function bmpByteLength(width: number, height: number): number {
  return HEADER_SIZE + rowStride(width) * height;
}

/** Encodes a top-down, 1-byte-per-pixel (0|1) buffer as a 1-bit BMP. */
export function encodeBmp(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const stride = rowStride(width);
  const fileSize = bmpByteLength(width, height);
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER (14 bytes)
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true); // reserved1 + reserved2
  view.setUint32(10, HEADER_SIZE, true); // pixel data offset

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, DIB_HEADER_SIZE, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive height = bottom-up rows
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 1, true); // bits per pixel
  view.setUint32(30, 0, true); // compression = BI_RGB
  view.setUint32(34, stride * height, true); // image data size
  view.setInt32(38, PIXELS_PER_METER, true);
  view.setInt32(42, PIXELS_PER_METER, true);
  view.setUint32(46, 2, true); // colors used
  view.setUint32(50, 2, true); // important colors

  // Color table (8 bytes): index 0 = black, index 1 = white, each BGRA.
  out[54] = 0x00;
  out[55] = 0x00;
  out[56] = 0x00;
  out[57] = 0x00;
  out[58] = 0xff;
  out[59] = 0xff;
  out[60] = 0xff;
  out[61] = 0x00;

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // BMP rows are bottom-up
    const rowOffset = HEADER_SIZE + y * stride;
    for (let x = 0; x < width; x++) {
      if (pixels[srcRow * width + x]) {
        out[rowOffset + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return out;
}

/** FNV-1a hash — used to skip re-sending an image tile whose bytes haven't changed. */
export function fnv32a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
