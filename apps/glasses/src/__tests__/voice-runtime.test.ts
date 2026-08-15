/**
 * Voice runtime wiring (src/voice-runtime.ts).
 *
 * Focus: overlapping refreshVoiceStatus calls while on-device warmUp is still
 * loading must not let a stale completion overwrite state.voice.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  applyVoiceConfig: vi.fn(),
  warmUp: vi.fn(),
  warmUpResolve: null as ((ok: boolean) => void) | null,
  warmUpPromise: null as Promise<boolean> | null,
}));

vi.mock('../stt', () => ({
  applyVoiceConfig: h.applyVoiceConfig,
  warmUp: h.warmUp,
}));

import { state } from '../state';
import { refreshVoiceStatus } from '../voice-runtime';

function deferWarmUp(): void {
  h.warmUpPromise = new Promise<boolean>((resolve) => {
    h.warmUpResolve = resolve;
  });
  h.warmUp.mockReturnValue(h.warmUpPromise);
}

beforeEach(() => {
  state.voice = 'unknown';
  h.applyVoiceConfig.mockReset();
  h.warmUp.mockReset();
  h.warmUpResolve = null;
  h.warmUpPromise = null;
});

describe('refreshVoiceStatus — overlapping calls', () => {
  it('ignores a stale warmUp when the user switches to off', async () => {
    h.applyVoiceConfig.mockResolvedValueOnce('preparing').mockResolvedValueOnce('off');
    deferWarmUp();

    const first = refreshVoiceStatus({ mode: 'on-device' });
    await Promise.resolve();
    expect(state.voice).toBe('preparing');

    await refreshVoiceStatus({ mode: 'off' });
    expect(state.voice).toBe('off');

    if (!h.warmUpResolve) throw new Error('warmUp was not deferred');
    h.warmUpResolve(true);
    await first;
    expect(state.voice).toBe('off');
  });

  it('ignores a stale warmUp when the user switches to cloud', async () => {
    h.applyVoiceConfig.mockResolvedValueOnce('preparing').mockResolvedValueOnce('ready');
    deferWarmUp();

    const first = refreshVoiceStatus({ mode: 'on-device' });
    await Promise.resolve();
    expect(state.voice).toBe('preparing');

    await refreshVoiceStatus({ mode: 'cloud', sonioxApiKey: 'soniox-key-abcdefghijklmnop' });
    expect(state.voice).toBe('ready');

    if (!h.warmUpResolve) throw new Error('warmUp was not deferred');
    h.warmUpResolve(true);
    await first;
    expect(state.voice).toBe('ready');
  });

  it('ignores a stale warmUp failure when a newer refresh already won', async () => {
    h.applyVoiceConfig.mockResolvedValueOnce('preparing').mockResolvedValueOnce('needs-key');
    deferWarmUp();

    const first = refreshVoiceStatus({ mode: 'on-device' });
    await Promise.resolve();

    await refreshVoiceStatus({ mode: 'cloud' });
    expect(state.voice).toBe('needs-key');

    if (!h.warmUpResolve) throw new Error('warmUp was not deferred');
    h.warmUpResolve(false);
    await first;
    expect(state.voice).toBe('needs-key');
  });
});
