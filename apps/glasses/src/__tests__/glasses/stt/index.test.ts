/**
 * STT façade (src/stt/index.ts).
 *
 * Focus: a superseded on-device applyVoiceConfig must not install Vosk after a
 * newer cloud/off choice has already replaced provider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSonioxProvider } from '../../../stt/soniox';

const h = vi.hoisted(() => ({
  hasModel: vi.fn(),
  clearVoskScratch: vi.fn(),
  openModelUrl: vi.fn(),
  voskCreated: 0,
  sonioxCreated: 0,
  sonioxEnsureReady: vi.fn(),
  voskEnsureReady: vi.fn(),
}));

vi.mock('../../../voice-model', () => ({
  hasModel: h.hasModel,
  clearVoskScratch: h.clearVoskScratch,
  openModelUrl: h.openModelUrl,
}));

vi.mock('../../../stt/vosk', () => ({
  createVoskProvider: vi.fn(() => {
    h.voskCreated++;
    return {
      ensureReady: h.voskEnsureReady,
      startListening: vi.fn(),
      feedAudio: vi.fn(),
      stopListening: vi.fn(),
      isListening: vi.fn(() => false),
      takeFailure: vi.fn(() => null),
      dispose: vi.fn(),
    };
  }),
}));

vi.mock('../../../stt/soniox', () => ({
  createSonioxProvider: vi.fn(() => {
    h.sonioxCreated++;
    return {
      ensureReady: h.sonioxEnsureReady,
      startListening: vi.fn(),
      feedAudio: vi.fn(),
      stopListening: vi.fn(),
      isListening: vi.fn(() => false),
      takeFailure: vi.fn(() => null),
      dispose: vi.fn(),
    };
  }),
}));

async function freshStt() {
  vi.resetModules();
  h.voskCreated = 0;
  h.sonioxCreated = 0;
  h.hasModel.mockReset();
  h.clearVoskScratch.mockReset();
  h.openModelUrl.mockReset();
  h.sonioxEnsureReady.mockReset();
  h.voskEnsureReady.mockReset();
  h.sonioxEnsureReady.mockResolvedValue(true);
  h.voskEnsureReady.mockResolvedValue(true);
  h.hasModel.mockResolvedValue(true);
  h.clearVoskScratch.mockResolvedValue(undefined);
  return import('../../../stt');
}

let revokeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  revokeSpy = vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  revokeSpy.mockRestore();
});

describe('applyVoiceConfig — overlapping on-device then cloud', () => {
  it('does not install Vosk when cloud wins before openModelUrl resolves', async () => {
    const stt = await freshStt();

    let resolveUrl: ((url: string) => void) | undefined;
    h.openModelUrl.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveUrl = resolve;
      }),
    );

    const onDevice = stt.applyVoiceConfig({ mode: 'on-device' });
    await vi.waitFor(() => expect(h.openModelUrl).toHaveBeenCalled());

    const cloud = stt.applyVoiceConfig({
      mode: 'cloud',
      sonioxApiKey: 'soniox-key-abcdefghijklmnop',
    });
    expect(await cloud).toBe('ready');
    expect(h.sonioxCreated).toBe(1);
    expect(h.voskCreated).toBe(0);

    if (!resolveUrl) throw new Error('openModelUrl was not deferred');
    resolveUrl('blob:stale-model');
    expect(await onDevice).toBe('off');
    expect(h.voskCreated).toBe(0);
    expect(revokeSpy).toHaveBeenCalledWith('blob:stale-model');

    await stt.ensureReady();
    expect(h.sonioxEnsureReady).toHaveBeenCalledTimes(1);
    expect(h.voskEnsureReady).not.toHaveBeenCalled();
  });

  it('does not install Vosk when off wins before openModelUrl resolves', async () => {
    const stt = await freshStt();

    let resolveUrl: ((url: string) => void) | undefined;
    h.openModelUrl.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveUrl = resolve;
      }),
    );

    const onDevice = stt.applyVoiceConfig({ mode: 'on-device' });
    await vi.waitFor(() => expect(h.openModelUrl).toHaveBeenCalled());

    expect(await stt.applyVoiceConfig({ mode: 'off' })).toBe('off');
    expect(h.voskCreated).toBe(0);

    if (!resolveUrl) throw new Error('openModelUrl was not deferred');
    resolveUrl('blob:stale-model');
    expect(await onDevice).toBe('off');
    expect(h.voskCreated).toBe(0);
    expect(revokeSpy).toHaveBeenCalledWith('blob:stale-model');
  });
});

describe('warmUp — captured provider', () => {
  it('warms the provider that was active when warmUp started', async () => {
    const stt = await freshStt();
    h.openModelUrl.mockResolvedValue('blob:model');

    expect(await stt.applyVoiceConfig({ mode: 'on-device' })).toBe('preparing');
    expect(h.voskCreated).toBe(1);

    let resolveWarm: (() => void) | undefined;
    h.voskEnsureReady.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveWarm = () => resolve(true);
        }),
    );

    const warm = stt.warmUp();
    await stt.applyVoiceConfig({ mode: 'off' });
    if (!resolveWarm) throw new Error('warmUp was not deferred');
    resolveWarm();
    expect(await warm).toBe(true);
    expect(h.voskEnsureReady).toHaveBeenCalledTimes(1);
  });
});

describe('applyVoiceConfig — cloud language hints', () => {
  it('passes language hints to the Soniox provider', async () => {
    const stt = await freshStt();
    vi.mocked(createSonioxProvider).mockClear();

    await stt.applyVoiceConfig({
      mode: 'cloud',
      sonioxApiKey: 'soniox-key-abcdefghijklmnop',
      sonioxLanguageHints: ['en', 'nl'],
      sonioxLanguageHintsStrict: true,
    });

    expect(createSonioxProvider).toHaveBeenCalledWith('soniox-key-abcdefghijklmnop', {
      languageHints: ['en', 'nl'],
      languageHintsStrict: true,
    });
  });
});
