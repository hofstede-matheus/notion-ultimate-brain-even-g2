/**
 * Voice backend selection and its credentials (src/voice-config.ts).
 *
 * The Soniox key is the sensitive part: it is stored under its own key rather
 * than in TenantConfig (which is base64'd into every request header to our own
 * server), and it must be registered for redaction so it never lands in the
 * debug log users copy into bug reports.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ bridge: null as unknown }));

vi.mock('../state', () => ({
  getBridge: () => mocks.bridge,
}));

import { _clearRegisteredSecretsForTests, redact } from '../logging/redact';
import { DEFAULT_VOICE_CONFIG, loadVoiceConfig, saveVoiceConfig } from '../voice-config';

/** Stand-in for the Even Hub bridge's async key-value storage. */
function fakeBridge() {
  const store = new Map<string, string>();
  return {
    store,
    getLocalStorage: vi.fn(async (k: string) => store.get(k) ?? ''),
    setLocalStorage: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
      return true;
    }),
  };
}

beforeEach(() => {
  mocks.bridge = null;
  _clearRegisteredSecretsForTests();
  vi.stubGlobal('window', { localStorage: new Map() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadVoiceConfig', () => {
  it('defaults to off when nothing is stored', async () => {
    mocks.bridge = fakeBridge();
    expect(await loadVoiceConfig()).toEqual(DEFAULT_VOICE_CONFIG);
  });

  it('round-trips a config through the bridge', async () => {
    const bridge = fakeBridge();
    mocks.bridge = bridge;

    await saveVoiceConfig({
      mode: 'cloud',
      sonioxApiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
      sonioxLanguageHints: ['en', 'nl'],
      sonioxLanguageHintsStrict: true,
    });

    expect(await loadVoiceConfig()).toEqual({
      mode: 'cloud',
      sonioxApiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
      sonioxLanguageHints: ['en', 'nl'],
      sonioxLanguageHintsStrict: true,
    });
  });

  it('drops unknown language codes from stored config', async () => {
    const bridge = fakeBridge();
    bridge.store.set(
      'notionultimatebrain:voice',
      JSON.stringify({
        mode: 'cloud',
        sonioxLanguageHints: ['en', 'not-a-language', 'xx'],
        sonioxLanguageHintsStrict: true,
      }),
    );
    mocks.bridge = bridge;

    expect(await loadVoiceConfig()).toEqual({
      mode: 'cloud',
      sonioxLanguageHints: ['en'],
      sonioxLanguageHintsStrict: true,
    });
  });

  it('ignores strict when no valid hints remain', async () => {
    const bridge = fakeBridge();
    bridge.store.set(
      'notionultimatebrain:voice',
      JSON.stringify({
        mode: 'cloud',
        sonioxLanguageHints: ['xx'],
        sonioxLanguageHintsStrict: true,
      }),
    );
    mocks.bridge = bridge;

    expect(await loadVoiceConfig()).toEqual({ mode: 'cloud' });
  });

  it('stores under its own key, never alongside the Notion tenant config', async () => {
    const bridge = fakeBridge();
    mocks.bridge = bridge;

    await saveVoiceConfig({ mode: 'on-device' });

    expect([...bridge.store.keys()]).toEqual(['notionultimatebrain:voice']);
  });

  it('falls back to the default on corrupt JSON', async () => {
    const bridge = fakeBridge();
    bridge.store.set('notionultimatebrain:voice', '{not json');
    mocks.bridge = bridge;

    expect(await loadVoiceConfig()).toEqual(DEFAULT_VOICE_CONFIG);
  });

  it('rejects an unrecognised mode rather than trusting it', async () => {
    const bridge = fakeBridge();
    bridge.store.set('notionultimatebrain:voice', JSON.stringify({ mode: 'telepathy' }));
    mocks.bridge = bridge;

    expect(await loadVoiceConfig()).toEqual(DEFAULT_VOICE_CONFIG);
  });
});

describe('api key redaction', () => {
  const key = 'soniox-secret-key-abcdefghij';

  it('registers the key on save so it cannot reach the debug log', async () => {
    mocks.bridge = fakeBridge();

    await saveVoiceConfig({ mode: 'cloud', sonioxApiKey: key });

    expect(redact(`connecting with ${key}`)).not.toContain(key);
  });

  it('registers the key on load too, for a session that never re-saves', async () => {
    const bridge = fakeBridge();
    bridge.store.set(
      'notionultimatebrain:voice',
      JSON.stringify({ mode: 'cloud', sonioxApiKey: key }),
    );
    mocks.bridge = bridge;

    await loadVoiceConfig();

    expect(redact(`connecting with ${key}`)).not.toContain(key);
  });
});
