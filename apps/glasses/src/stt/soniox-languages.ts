/**
 * Soniox-supported ISO 639-1 language codes.
 *
 * Kept in sync with https://soniox.com/docs/stt/concepts/supported-languages
 * so a typo fails in Settings rather than as a 400 mid-recording on the glasses.
 */

/** Two-letter codes Soniox accepts in `language_hints`. */
export const SONIOX_LANGUAGE_CODES = new Set([
  'af',
  'sq',
  'ar',
  'az',
  'eu',
  'be',
  'bn',
  'bs',
  'bg',
  'ca',
  'zh',
  'hr',
  'cs',
  'da',
  'nl',
  'en',
  'et',
  'fi',
  'fr',
  'gl',
  'de',
  'el',
  'gu',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'kn',
  'kk',
  'ko',
  'lv',
  'lt',
  'mk',
  'ms',
  'ml',
  'mr',
  'no',
  'fa',
  'pl',
  'pt',
  'pa',
  'ro',
  'ru',
  'sr',
  'sk',
  'sl',
  'es',
  'sw',
  'sv',
  'tl',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'ur',
  'vi',
  'cy',
]);

export function isSonioxLanguageCode(code: string): boolean {
  return SONIOX_LANGUAGE_CODES.has(code);
}

/** Keep only known codes, in first-seen order. */
export function sanitizeLanguageHints(codes: string[] | undefined): string[] {
  if (!codes?.length) return [];
  const out: string[] = [];
  for (const raw of codes) {
    const code = raw.trim().toLowerCase();
    if (!isSonioxLanguageCode(code) || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

export interface ParsedLanguageHints {
  codes: string[];
  invalid: string[];
}

/**
 * Parse a comma-separated hints field from Settings.
 * Tokens are lowercased; duplicates are dropped; unknown codes are reported.
 */
export function parseLanguageHints(raw: string): ParsedLanguageHints {
  const codes: string[] = [];
  const invalid: string[] = [];
  for (const token of raw.split(/[,\s]+/)) {
    const code = token.trim().toLowerCase();
    if (!code) continue;
    if (!isSonioxLanguageCode(code)) {
      if (!invalid.includes(code)) invalid.push(code);
      continue;
    }
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes, invalid };
}

/** Format stored hints for the Settings text field. */
export function formatLanguageHints(codes: string[]): string {
  return sanitizeLanguageHints(codes).join(', ');
}
