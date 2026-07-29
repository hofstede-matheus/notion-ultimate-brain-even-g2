import { describe, expect, it } from 'vitest';
import {
  createBuffer,
  fillRect,
  getPixel,
  hLine,
  invertRect,
  setPixel,
  sliceRect,
  sliceRows,
  stippleRect,
  strokeRect,
  vLine,
} from '../../../glasses/bitmap/pixels';

describe('createBuffer / setPixel / getPixel', () => {
  it('creates a zeroed width*height buffer', () => {
    const buf = createBuffer(4, 3);
    expect(buf.length).toBe(12);
    expect([...buf].every((v) => v === 0)).toBe(true);
  });

  it('sets and reads a pixel at its row-major index', () => {
    const buf = createBuffer(4, 3);
    setPixel(buf, 4, 3, 2, 1, 1);
    expect(getPixel(buf, 4, 2, 1)).toBe(1);
    expect(buf[1 * 4 + 2]).toBe(1);
  });

  it('silently drops out-of-bounds writes', () => {
    const buf = createBuffer(2, 2);
    setPixel(buf, 2, 2, -1, 0, 1);
    setPixel(buf, 2, 2, 5, 0, 1);
    setPixel(buf, 2, 2, 0, -1, 1);
    setPixel(buf, 2, 2, 0, 5, 1);
    expect([...buf].every((v) => v === 0)).toBe(true);
  });
});

describe('hLine / vLine', () => {
  it('draws a horizontal run of the given length', () => {
    const buf = createBuffer(5, 3);
    hLine(buf, 5, 3, 1, 1, 3, 1);
    expect([...buf]).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('draws a vertical run of the given length', () => {
    const buf = createBuffer(3, 3);
    vLine(buf, 3, 3, 1, 0, 3, 1);
    expect(getPixel(buf, 3, 1, 0)).toBe(1);
    expect(getPixel(buf, 3, 1, 1)).toBe(1);
    expect(getPixel(buf, 3, 1, 2)).toBe(1);
    expect(getPixel(buf, 3, 0, 1)).toBe(0);
  });
});

describe('fillRect', () => {
  it('fills every pixel in the rect and none outside it', () => {
    const buf = createBuffer(5, 5);
    fillRect(buf, 5, 5, 1, 1, 2, 2, 1);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const inside = x >= 1 && x < 3 && y >= 1 && y < 3;
        expect(getPixel(buf, 5, x, y)).toBe(inside ? 1 : 0);
      }
    }
  });
});

describe('strokeRect', () => {
  it('draws only the border at the given thickness, leaving the interior untouched', () => {
    const buf = createBuffer(6, 6);
    strokeRect(buf, 6, 6, 1, 1, 4, 4, 1, 1);
    // Center pixel of a 4x4 rect at (1,1) is untouched.
    expect(getPixel(buf, 6, 2, 2)).toBe(0);
    expect(getPixel(buf, 6, 3, 3)).toBe(0);
    // Corners of the border are set.
    expect(getPixel(buf, 6, 1, 1)).toBe(1);
    expect(getPixel(buf, 6, 4, 1)).toBe(1);
    expect(getPixel(buf, 6, 1, 4)).toBe(1);
    expect(getPixel(buf, 6, 4, 4)).toBe(1);
  });
});

describe('invertRect', () => {
  it('flips 0<->1 within the rect and leaves everything else alone', () => {
    const buf = createBuffer(4, 4);
    setPixel(buf, 4, 4, 1, 1, 1);
    invertRect(buf, 4, 4, 0, 0, 2, 2);
    expect(getPixel(buf, 4, 0, 0)).toBe(1);
    expect(getPixel(buf, 4, 1, 0)).toBe(1);
    expect(getPixel(buf, 4, 0, 1)).toBe(1);
    expect(getPixel(buf, 4, 1, 1)).toBe(0); // was 1, flipped to 0
    expect(getPixel(buf, 4, 2, 2)).toBe(0); // outside the rect, untouched
  });

  it('tolerates a rect that runs past the buffer edge', () => {
    const buf = createBuffer(2, 2);
    expect(() => invertRect(buf, 2, 2, 1, 1, 3, 3)).not.toThrow();
    expect(getPixel(buf, 2, 1, 1)).toBe(1);
  });
});

describe('stippleRect', () => {
  it('fills a checkerboard pattern, not a solid block', () => {
    const buf = createBuffer(4, 4);
    stippleRect(buf, 4, 4, 0, 0, 4, 4, 1);
    const on = [...buf].filter((v) => v === 1).length;
    // Roughly half the pixels are set, and it's not a solid fill.
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(16);
    expect(getPixel(buf, 4, 0, 0)).toBe(1); // (0+0)%2===0
    expect(getPixel(buf, 4, 1, 0)).toBe(0); // (1+0)%2!==0
  });
});

describe('sliceRows', () => {
  it('extracts the requested row range into a new buffer', () => {
    const buf = createBuffer(2, 4);
    setPixel(buf, 2, 4, 0, 2, 1);
    setPixel(buf, 2, 4, 1, 3, 1);
    const slice = sliceRows(buf, 2, 2, 2);
    expect(slice.length).toBe(4);
    expect(getPixel(slice, 2, 0, 0)).toBe(1); // was row 2
    expect(getPixel(slice, 2, 1, 1)).toBe(1); // was row 3
  });
});

describe('sliceRect', () => {
  it('extracts a quadrant into a new, tightly-packed buffer', () => {
    const buf = createBuffer(4, 4);
    // Mark one pixel in each quadrant of a 4x4 buffer split into 2x2 tiles.
    setPixel(buf, 4, 4, 0, 0, 1); // top-left quadrant
    setPixel(buf, 4, 4, 3, 0, 1); // top-right quadrant
    setPixel(buf, 4, 4, 0, 3, 1); // bottom-left quadrant
    setPixel(buf, 4, 4, 3, 3, 1); // bottom-right quadrant

    const topLeft = sliceRect(buf, 4, 0, 0, 2, 2);
    expect(topLeft.length).toBe(4);
    expect(getPixel(topLeft, 2, 0, 0)).toBe(1);
    expect(getPixel(topLeft, 2, 1, 1)).toBe(0);

    const topRight = sliceRect(buf, 4, 2, 0, 2, 2);
    expect(getPixel(topRight, 2, 1, 0)).toBe(1); // was (3,0)

    const bottomLeft = sliceRect(buf, 4, 0, 2, 2, 2);
    expect(getPixel(bottomLeft, 2, 0, 1)).toBe(1); // was (0,3)

    const bottomRight = sliceRect(buf, 4, 2, 2, 2, 2);
    expect(getPixel(bottomRight, 2, 1, 1)).toBe(1); // was (3,3)
  });

  it('does not bleed pixels from the neighbouring quadrant across the cut', () => {
    const buf = createBuffer(4, 2);
    fillRect(buf, 4, 2, 0, 0, 2, 2, 1); // left half fully on, right half off
    const left = sliceRect(buf, 4, 0, 0, 2, 2);
    const right = sliceRect(buf, 4, 2, 0, 2, 2);
    expect([...left].every((v) => v === 1)).toBe(true);
    expect([...right].every((v) => v === 0)).toBe(true);
  });
});
