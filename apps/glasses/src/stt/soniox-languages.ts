import { SONIOX_LANGUAGE_CODES } from './soniox-language-codes';

export { SONIOX_LANGUAGE_CODES };

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
