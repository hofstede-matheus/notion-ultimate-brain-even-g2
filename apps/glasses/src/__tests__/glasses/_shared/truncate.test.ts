/**
 * Pixel-accurate list-label truncation (screen-factories.ts's
 * truncateListLabel/truncatePrefixedListLabel) — replaces a byte-count
 * proxy with even-toolkit/pretext's LVGL-accurate pxTruncate, then keeps
 * the firmware's 63-byte-per-item cap as a backstop (it rejects the whole
 * rebuild if crossed, and byte length isn't derivable from a pixel-fit
 * string alone — see the "byte-cap backstop" case below for a real example).
 */
import { describe, expect, it } from 'vitest';
import {
  truncateListLabel,
  truncatePrefixedListLabel,
} from '../../../glasses/modules/_shared/screen-factories';

const byteLength = (s: string) => new TextEncoder().encode(s).length;

describe('truncateListLabel', () => {
  it('returns short text unchanged', () => {
    expect(truncateListLabel('Buy milk')).toBe('Buy milk');
  });

  it('truncates long ASCII text with a pixel-accurate ellipsis', () => {
    const long = 'A'.repeat(120);
    const result = truncateListLabel(long);

    expect(result).not.toBe(long);
    expect(result.endsWith('...')).toBe(true);
    expect(byteLength(result)).toBeLessThanOrEqual(63);
  });

  it('applies the byte-cap backstop when pixel-fit text still exceeds the firmware limit', () => {
    // Accented Portuguese text: at 552px (the list row's inner width),
    // pxTruncate alone yields ~67 bytes here — over the 63-byte cap that
    // rejects the whole rebuild. This is exactly the accented-name
    // over-truncation gap the byte-only proxy had in the other direction.
    const accented = 'Configuração do relatório mensal de atividades da equipe de operações';
    const result = truncateListLabel(accented);

    expect(byteLength(result)).toBeLessThanOrEqual(63);
  });
});

describe('truncatePrefixedListLabel', () => {
  it('keeps prefix and short text unchanged', () => {
    expect(truncatePrefixedListLabel('Confirm: ', 'Buy milk')).toBe('Confirm: Buy milk');
  });

  it('truncates the text portion so prefix + text fit the list row and the byte cap', () => {
    const long = 'A'.repeat(120);
    const result = truncatePrefixedListLabel('Confirm: ', long);

    expect(result.startsWith('Confirm: ')).toBe(true);
    expect(byteLength(result)).toBeLessThanOrEqual(63);
  });

  it('handles empty text, leaving just the prefix', () => {
    expect(truncatePrefixedListLabel('To ', '')).toBe('To ');
  });
});
