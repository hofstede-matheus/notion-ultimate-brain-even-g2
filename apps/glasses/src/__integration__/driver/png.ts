import { PNG } from 'pngjs';

/**
 * The glasses framebuffer PNG is RGBA with background `(0,255,0,0)` and text
 * `(0,255,0,255)` — both pure green, so alpha is the only channel that tells
 * them apart. Collapsing to RGB (or checking any other channel) fuses text
 * into background; see CLAUDE.md's simulator notes.
 */
export function litPixelRatio(pngBuffer: Buffer): number {
  const png = PNG.sync.read(pngBuffer);
  const { data, width, height } = png;
  const total = width * height;
  if (total === 0) return 0;

  let lit = 0;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) > 0) lit++;
  }
  return lit / total;
}
