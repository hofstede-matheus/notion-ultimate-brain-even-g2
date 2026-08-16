/**
 * 5×7 bitmap font — only the glyphs the due-date calendar needs: digits,
 * the letters in "PREV MONTH" / "NEXT MONTH", and the weekday initials
 * (S M T W T F S). Glyph art lives in font5x7-glyphs.ts; this file draws it.
 */
import { GLYPH_ART } from './font5x7-glyphs';
import { setPixel } from './pixels';

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;

function glyphBit(rows: string[], row: number, col: number): boolean {
  return rows[row]?.[col] === '#';
}

export interface DrawTextOptions {
  /** Integer pixel scale factor. Defaults to 1. */
  scale?: number;
  /**
   * Renders the glyph as a "hole" in an already-filled cell: strokes become
   * 0, background becomes 1 (matching the surrounding fill). Used for the
   * day-cursor cell, which is filled solid before the digit is drawn.
   */
  invert?: boolean;
  /**
   * Draws strokes as a checkerboard instead of solid — dims out-of-month
   * days without needing a separate greyed-out color.
   */
  stipple?: boolean;
}

/** Draws one glyph at (x, y) top-left. Returns the advance width in pixels. */
export function drawGlyph(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  ch: string,
  options: DrawTextOptions = {},
): number {
  const scale = options.scale ?? 1;
  const rows = GLYPH_ART[ch.toUpperCase()] ?? GLYPH_ART[' '] ?? [];

  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    for (let col = 0; col < GLYPH_WIDTH; col++) {
      const isStroke = glyphBit(rows, row, col);
      let value: 0 | 1 | null;
      if (isStroke) {
        value = options.stipple
          ? (((row + col) % 2 === 0 ? 1 : 0) as 0 | 1)
          : options.invert
            ? 0
            : 1;
      } else {
        // Off pixels stay transparent (no-op) except in invert mode, where
        // they must match the already-filled cell background.
        value = options.invert ? 1 : null;
      }
      if (value === null) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setPixel(buf, width, height, x + col * scale + sx, y + row * scale + sy, value);
        }
      }
    }
  }
  return GLYPH_WIDTH * scale + scale;
}

/** Draws left-to-right text starting at (x, y). Returns the total width consumed. */
export function drawText(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  text: string,
  options: DrawTextOptions = {},
): number {
  let cursor = x;
  for (const ch of text) {
    cursor += drawGlyph(buf, width, height, cursor, y, ch, options);
  }
  return cursor - x;
}

/** Total width `text` would occupy at the given scale, without drawing — for centring. */
export function measureText(text: string, scale = 1): number {
  return text.length * (GLYPH_WIDTH * scale + scale);
}
