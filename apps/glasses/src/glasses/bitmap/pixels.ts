/**
 * 1-byte-per-pixel (0|1) framebuffer utilities — no DOM, no SDK dependency,
 * so the calendar picker's drawing code runs under vitest's node environment
 * like the rest of this app.
 */

export function createBuffer(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

export function setPixel(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  value: 0 | 1,
): void {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  buf[y * width + x] = value;
}

export function getPixel(buf: Uint8Array, width: number, x: number, y: number): number {
  return buf[y * width + x] ?? 0;
}

export function hLine(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  length: number,
  value: 0 | 1,
): void {
  for (let dx = 0; dx < length; dx++) setPixel(buf, width, height, x + dx, y, value);
}

export function vLine(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  length: number,
  value: 0 | 1,
): void {
  for (let dy = 0; dy < length; dy++) setPixel(buf, width, height, x, y + dy, value);
}

export function fillRect(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectW: number,
  rectH: number,
  value: 0 | 1,
): void {
  for (let dy = 0; dy < rectH; dy++) hLine(buf, width, height, x, y + dy, rectW, value);
}

export function strokeRect(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectW: number,
  rectH: number,
  thickness: number,
  value: 0 | 1,
): void {
  for (let t = 0; t < thickness; t++) {
    hLine(buf, width, height, x, y + t, rectW, value);
    hLine(buf, width, height, x, y + rectH - 1 - t, rectW, value);
    vLine(buf, width, height, x + t, y, rectH, value);
    vLine(buf, width, height, x + rectW - 1 - t, y, rectH, value);
  }
}

/**
 * Flips every pixel in the rect (0<->1) — used for the day-cursor cell so it
 * reads correctly regardless of whatever's already drawn under it (today's
 * outline, a due-date dot).
 */
export function invertRect(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectW: number,
  rectH: number,
): void {
  for (let dy = 0; dy < rectH; dy++) {
    const py = y + dy;
    if (py < 0 || py >= height) continue;
    for (let dx = 0; dx < rectW; dx++) {
      const px = x + dx;
      if (px < 0 || px >= width) continue;
      const idx = py * width + px;
      buf[idx] = buf[idx] ? 0 : 1;
    }
  }
}

/**
 * Checkerboard fill — reads as visually distinct from a solid fill, used to
 * dim out-of-month days without competing for attention with in-month ones.
 */
export function stippleRect(
  buf: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectW: number,
  rectH: number,
  value: 0 | 1,
): void {
  for (let dy = 0; dy < rectH; dy++) {
    for (let dx = 0; dx < rectW; dx++) {
      if ((dx + dy) % 2 === 0) setPixel(buf, width, height, x + dx, y + dy, value);
    }
  }
}

/**
 * Extracts rows [y0, y0+sliceHeight) into a new width×sliceHeight buffer —
 * used to cut one logical calendar buffer into the two SDK image tiles.
 */
export function sliceRows(
  buf: Uint8Array,
  width: number,
  y0: number,
  sliceHeight: number,
): Uint8Array {
  return buf.slice(y0 * width, (y0 + sliceHeight) * width);
}

/**
 * Extracts a w×h rectangle at (x0, y0) into a new, tightly-packed buffer —
 * used to quarter the calendar's logical buffer into 2×2 SDK image tiles.
 */
export function sliceRect(
  buf: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const srcStart = (y0 + y) * width + x0;
    out.set(buf.subarray(srcStart, srcStart + w), y * w);
  }
  return out;
}
