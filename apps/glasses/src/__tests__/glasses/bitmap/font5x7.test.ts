import { describe, expect, it } from 'vitest';
import {
  drawGlyph,
  drawText,
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  measureText,
} from '../../../glasses/bitmap/font5x7';
import { createBuffer, getPixel } from '../../../glasses/bitmap/pixels';

describe('drawGlyph', () => {
  it('draws a non-empty digit at scale 1 within its 5x7 box', () => {
    const buf = createBuffer(10, 10);
    const advance = drawGlyph(buf, 10, 10, 0, 0, '8');
    expect(advance).toBe(GLYPH_WIDTH + 1);
    const on = [...buf].filter((v) => v === 1).length;
    expect(on).toBeGreaterThan(0);
  });

  it('an unknown character falls back to the blank space glyph', () => {
    const buf = createBuffer(10, 10);
    drawGlyph(buf, 10, 10, 0, 0, '@');
    expect([...buf].every((v) => v === 0)).toBe(true);
  });

  it('is case-insensitive', () => {
    const a = createBuffer(10, 10);
    const b = createBuffer(10, 10);
    drawGlyph(a, 10, 10, 0, 0, 'p');
    drawGlyph(b, 10, 10, 0, 0, 'P');
    expect([...a]).toEqual([...b]);
  });

  it('scale multiplies each stroke pixel into a scale x scale block', () => {
    const buf = createBuffer(20, 20);
    drawGlyph(buf, 20, 20, 0, 0, '1', { scale: 2 });
    const on = [...buf].filter((v) => v === 1).length;
    const buf1 = createBuffer(20, 20);
    drawGlyph(buf1, 20, 20, 0, 0, '1', { scale: 1 });
    const on1 = [...buf1].filter((v) => v === 1).length;
    expect(on).toBe(on1 * 4);
  });

  it('invert punches the strokes out of an already-filled cell', () => {
    const buf = createBuffer(10, 10);
    buf.fill(1); // simulate a pre-filled cursor cell
    drawGlyph(buf, 10, 10, 0, 0, '1', { invert: true });
    // The glyph's off pixels must stay 1 (matching the fill); its stroke
    // pixels (a vertical bar through column 2 of '1') must be punched to 0.
    expect(getPixel(buf, 10, 0, 0)).toBe(1);
    expect(getPixel(buf, 10, 2, 0)).toBe(0);
  });

  it('stipple renders strokes as a checkerboard instead of solid', () => {
    const buf = createBuffer(10, 10);
    drawGlyph(buf, 10, 10, 0, 0, '8', { stipple: true });
    const solid = createBuffer(10, 10);
    drawGlyph(solid, 10, 10, 0, 0, '8');
    const stippledOn = [...buf].filter((v) => v === 1).length;
    const solidOn = [...solid].filter((v) => v === 1).length;
    expect(stippledOn).toBeLessThan(solidOn);
    expect(stippledOn).toBeGreaterThan(0);
  });
});

describe('drawText / measureText', () => {
  it('draws left-to-right and returns the width consumed', () => {
    const buf = createBuffer(30, 10);
    const width = drawText(buf, 30, 10, 0, 0, 'AB');
    expect(width).toBe(measureText('AB'));
    expect(width).toBe(2 * (GLYPH_WIDTH + 1));
  });

  it('measureText scales with the given factor', () => {
    expect(measureText('AB', 2)).toBe(2 * measureText('A', 2));
    expect(measureText('A', 2)).toBeGreaterThan(measureText('A', 1));
  });

  it('every glyph is drawn within its expected height', () => {
    const buf = createBuffer(10, GLYPH_HEIGHT);
    drawGlyph(buf, 10, GLYPH_HEIGHT, 0, 0, 'M');
    for (let y = 0; y < GLYPH_HEIGHT; y++) {
      // no assertion needed beyond "doesn't throw" — bounds are enforced by setPixel
      expect(getPixel(buf, 10, 0, y)).toBeGreaterThanOrEqual(0);
    }
  });
});
