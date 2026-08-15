/**
 * Pure logic behind the Settings voice section
 * (src/web/screens/SettingsForm/voiceSection.ts).
 */

import { describe, expect, it } from 'vitest';
import {
  downloadPercent,
  formatProgress,
  isPlausibleApiKey,
  isVoiceReady,
  voiceConfigAfterDownload,
  VOICE_MODES,
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

describe('voiceConfigAfterDownload', () => {
  it('returns null when the user switched to off', () => {
    expect(voiceConfigAfterDownload('off', '')).toBeNull();
  });

  it('returns null when the user switched to cloud', () => {
    expect(voiceConfigAfterDownload('cloud', 'soniox-key-abcdefghijklmnop')).toBeNull();
  });

  it('persists on-device when that mode is still selected', () => {
    expect(voiceConfigAfterDownload('on-device', '')).toEqual({ mode: 'on-device' });
  });

  it('preserves a saved Soniox key when still on-device', () => {
    const key = 'soniox-key-abcdefghijklmnop';
    expect(voiceConfigAfterDownload('on-device', key)).toEqual({
      mode: 'on-device',
      sonioxApiKey: key,
    });
  });
});

describe('VOICE_MODES', () => {
  it('offers exactly the three exclusive modes, off first', () => {
    expect(VOICE_MODES.map((m) => m.value)).toEqual(['off', 'on-device', 'cloud']);
  });
});
