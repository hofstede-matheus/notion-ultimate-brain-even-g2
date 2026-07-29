import { describe, expect, it } from 'vitest';
import { bmpByteLength, encodeBmp, fnv32a } from '../../../glasses/bitmap/bmp';

describe('encodeBmp', () => {
  it('writes the standard 62-byte 1-bit BMP header', () => {
    const pixels = new Uint8Array(8 * 8);
    const bmp = encodeBmp(pixels, 8, 8);

    expect(bmp[0]).toBe(0x42); // 'B'
    expect(bmp[1]).toBe(0x4d); // 'M'
    const view = new DataView(bmp.buffer);
    expect(view.getUint32(2, true)).toBe(bmp.length); // file size
    expect(view.getUint32(10, true)).toBe(62); // pixel data offset
    expect(view.getUint32(14, true)).toBe(40); // DIB header size
    expect(view.getInt32(18, true)).toBe(8); // width
    expect(view.getInt32(22, true)).toBe(8); // height (positive = bottom-up)
    expect(view.getUint16(28, true)).toBe(1); // 1 bit per pixel
    expect(view.getUint32(46, true)).toBe(2); // colors used
  });

  it('matches bmpByteLength for a width that is not a multiple of 32', () => {
    const pixels = new Uint8Array(10 * 4);
    const bmp = encodeBmp(pixels, 10, 4);
    expect(bmp.length).toBe(bmpByteLength(10, 4));
    // 10px -> 2 bytes/row unpadded -> padded to 4-byte stride = 4 bytes/row
    expect(bmp.length).toBe(62 + 4 * 4);
  });

  it('encodes rows bottom-up, per the BMP spec', () => {
    // top-down source: row 0 all-on, row 1 all-off
    const pixels = new Uint8Array(8 * 2);
    pixels.fill(1, 0, 8); // row 0
    const bmp = encodeBmp(pixels, 8, 2);
    const rowStride = 4; // 8px = 1 byte, padded to 4
    const firstFileRow = bmp.slice(62, 62 + rowStride);
    const secondFileRow = bmp.slice(62 + rowStride, 62 + 2 * rowStride);
    // BMP's first stored row is the source's LAST row (bottom-up) — row 1, all-off.
    expect(firstFileRow[0]).toBe(0x00);
    // The second stored row is source row 0, all-on -> 0xff.
    expect(secondFileRow[0]).toBe(0xff);
  });

  it('packs 8 pixels per byte, MSB first', () => {
    // A single row: pixel 0 on, rest off -> top bit of byte 0 set.
    const pixels = new Uint8Array(8 * 1);
    pixels[0] = 1;
    const bmp = encodeBmp(pixels, 8, 1);
    expect(bmp[62]).toBe(0b10000000);
  });
});

describe('fnv32a', () => {
  it('is deterministic for the same bytes', () => {
    const a = fnv32a(new Uint8Array([1, 2, 3, 4]));
    const b = fnv32a(new Uint8Array([1, 2, 3, 4]));
    expect(a).toBe(b);
  });

  it('differs for different bytes', () => {
    const a = fnv32a(new Uint8Array([1, 2, 3, 4]));
    const b = fnv32a(new Uint8Array([1, 2, 3, 5]));
    expect(a).not.toBe(b);
  });

  it('returns an unsigned 32-bit value', () => {
    const h = fnv32a(new Uint8Array([255, 255, 255, 255]));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
