/**
 * Pure logic behind the Settings voice section
 * (src/web/screens/SettingsForm/voiceSection.ts).
 */

import { describe, expect, it } from 'vitest';
import { parseLanguageHints } from '../../stt/soniox-languages';
import {
  downloadPercent,
  formatProgress,
  isPlausibleApiKey,
  isVoiceReady,
  languageHintsError,
  VOICE_MODES,
  voiceConfigFromDraft,
} from '../../web/screens/SettingsForm/voiceSection';

describe('downloadPercent', () => {
  it('reports whole percentages of the declared total', () => {
    expect(downloadPercent(0, 41_000_000)).toBe(0);
    expect(downloadPercent(20_500_000, 41_000_000)).toBe(50);
    expect(downloadPercent(41_000_000, 41_000_000)).toBe(100);
  });

  it('is null when the server declared no length, so the bar can go indeterminate', () => {
    expect(downloadPercent(1_000_000, 0)).toBeNull();
  });

  it('never exceeds 100, even if more arrives than was declared', () => {
    expect(downloadPercent(50_000_000, 41_000_000)).toBe(100);
  });
});

describe('formatProgress', () => {
  it('shows received against total', () => {
    expect(formatProgress(24_000_000, 41_000_000)).toBe('24 MB / 41 MB');
  });

  it('shows only what has arrived when the total is unknown', () => {
    expect(formatProgress(24_000_000, 0)).toBe('24 MB');
  });
});

describe('isPlausibleApiKey', () => {
  it('rejects empty and obviously-too-short values', () => {
    expect(isPlausibleApiKey('')).toBe(false);
    expect(isPlausibleApiKey('   ')).toBe(false);
    expect(isPlausibleApiKey('abc123')).toBe(false);
  });

  it('accepts a key-length string', () => {
    expect(isPlausibleApiKey('soniox-key-abcdefghijklmnop')).toBe(true);
  });
});

describe('isVoiceReady', () => {
  it('is never ready when voice is off', () => {
    expect(isVoiceReady('off', 'ready', 'soniox-key-abcdefghijklmnop')).toBe(false);
  });

  it('needs the model downloaded for on-device', () => {
    expect(isVoiceReady('on-device', 'absent', undefined)).toBe(false);
    expect(isVoiceReady('on-device', 'downloading', undefined)).toBe(false);
    expect(isVoiceReady('on-device', 'ready', undefined)).toBe(true);
  });

  it('needs a key for cloud, and ignores the model entirely', () => {
    expect(isVoiceReady('cloud', 'absent', undefined)).toBe(false);
    expect(isVoiceReady('cloud', 'absent', 'soniox-key-abcdefghijklmnop')).toBe(true);
  });
});

describe('parseLanguageHints', () => {
  it('normalises comma-separated codes to unique lowercase', () => {
    expect(parseLanguageHints('en, NL  es')).toEqual({ codes: ['en', 'nl', 'es'], invalid: [] });
  });

  it('reports unknown tokens', () => {
    expect(parseLanguageHints('en, xx')).toEqual({ codes: ['en'], invalid: ['xx'] });
  });

  it('returns empty for blank input', () => {
    expect(parseLanguageHints('   ')).toEqual({ codes: [], invalid: [] });
  });
});

describe('languageHintsError', () => {
  it('is null when all tokens are valid', () => {
    expect(languageHintsError('en, nl')).toBeNull();
  });

  it('describes unknown codes', () => {
    expect(languageHintsError('xx')).toMatch(/Unknown code: xx/);
  });
});

describe('voiceConfigFromDraft', () => {
  it('always includes the chosen mode', () => {
    expect(voiceConfigFromDraft('off', '', '', false)).toEqual({ mode: 'off' });
    expect(voiceConfigFromDraft('on-device', '', '', false)).toEqual({ mode: 'on-device' });
    expect(voiceConfigFromDraft('cloud', '', '', false)).toEqual({ mode: 'cloud' });
  });

  it('includes a plausible key for any mode so switching off does not discard it', () => {
    const key = 'soniox-key-abcdefghijklmnop';
    expect(voiceConfigFromDraft('off', key, '', false)).toEqual({ mode: 'off', sonioxApiKey: key });
    expect(voiceConfigFromDraft('on-device', key, '', false)).toEqual({
      mode: 'on-device',
      sonioxApiKey: key,
    });
    expect(voiceConfigFromDraft('cloud', key, '', false)).toEqual({
      mode: 'cloud',
      sonioxApiKey: key,
    });
  });

  it('omits an incomplete key, clearing a previously stored one on Save', () => {
    expect(voiceConfigFromDraft('cloud', 'abc', '', false)).toEqual({ mode: 'cloud' });
    expect(voiceConfigFromDraft('cloud', '   ', '', false)).toEqual({ mode: 'cloud' });
  });

  it('trims whitespace from a plausible key', () => {
    const key = 'soniox-key-abcdefghijklmnop';
    expect(voiceConfigFromDraft('cloud', `  ${key}  `, '', false)).toEqual({
      mode: 'cloud',
      sonioxApiKey: key,
    });
  });

  it('includes language hints when valid codes are present', () => {
    expect(voiceConfigFromDraft('cloud', '', 'en, nl', false)).toEqual({
      mode: 'cloud',
      sonioxLanguageHints: ['en', 'nl'],
    });
  });

  it('omits hints when the field is empty', () => {
    expect(voiceConfigFromDraft('cloud', '', '', false)).toEqual({ mode: 'cloud' });
  });

  it('drops invalid codes on save', () => {
    expect(voiceConfigFromDraft('cloud', '', 'en, xx', false)).toEqual({
      mode: 'cloud',
      sonioxLanguageHints: ['en'],
    });
  });

  it('includes strict only when hints are non-empty', () => {
    expect(voiceConfigFromDraft('cloud', '', 'en', true)).toEqual({
      mode: 'cloud',
      sonioxLanguageHints: ['en'],
      sonioxLanguageHintsStrict: true,
    });
    expect(voiceConfigFromDraft('cloud', '', '', true)).toEqual({ mode: 'cloud' });
  });
});

describe('VOICE_MODES', () => {
  it('offers exactly the three exclusive modes, off first', () => {
    expect(VOICE_MODES.map((m) => m.value)).toEqual(['off', 'on-device', 'cloud']);
    expect(VOICE_MODES.map((m) => m.label)).toEqual(['Off', 'On-device', 'Cloud (Soniox)']);
  });
});
