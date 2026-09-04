/**
 * The status screen's "what's new" card (web/whats-new.ts) — dismissed-ids persistence and the
 * pure isDismissed check. Same bridge/localStorage-fallback shape as services/config.ts's
 * db-picker state, under its own storage key rather than TenantConfig.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ bridge: null as unknown }));

vi.mock('../../state', () => ({
  getBridge: () => mocks.bridge,
}));

import {
  dismissWhatsNew,
  isDismissed,
  loadDismissedWhatsNew,
  WHATS_NEW_ENTRY,
} from '../../web/whats-new';

const STORAGE_KEY = 'notionultimatebrain:whatsnew-dismissed';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDismissed', () => {
  it('is false when the id is not in the list', () => {
    expect(isDismissed([], 'context-menu')).toBe(false);
    expect(isDismissed(['some-other-id'], 'context-menu')).toBe(false);
  });

  it('is true once the id is in the list', () => {
    expect(isDismissed(['context-menu'], 'context-menu')).toBe(true);
  });
});

describe('loadDismissedWhatsNew', () => {
  it('defaults to an empty list when nothing is stored', async () => {
    mocks.bridge = fakeBridge();
    expect(await loadDismissedWhatsNew()).toEqual([]);
  });

  it('round-trips a dismissal through the bridge', async () => {
    const bridge = fakeBridge();
    mocks.bridge = bridge;

    await dismissWhatsNew('context-menu');

    expect(await loadDismissedWhatsNew()).toEqual(['context-menu']);
    expect(bridge.setLocalStorage).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(['context-menu']),
    );
  });

  it('dismissing the same id twice does not duplicate it', async () => {
    mocks.bridge = fakeBridge();

    await dismissWhatsNew('context-menu');
    await dismissWhatsNew('context-menu');

    expect(await loadDismissedWhatsNew()).toEqual(['context-menu']);
  });

  it('dismissing a second entry keeps the first', async () => {
    mocks.bridge = fakeBridge();

    await dismissWhatsNew('context-menu');
    await dismissWhatsNew('some-later-feature');

    expect(await loadDismissedWhatsNew()).toEqual(['context-menu', 'some-later-feature']);
  });

  it('falls back to an empty list on corrupt stored data, rather than throwing', async () => {
    const bridge = fakeBridge();
    bridge.store.set(STORAGE_KEY, '{not valid json');
    mocks.bridge = bridge;

    await expect(loadDismissedWhatsNew()).resolves.toEqual([]);
  });

  it('falls back to an empty list when the stored value is not an array, rather than throwing', async () => {
    const bridge = fakeBridge();
    bridge.store.set(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    mocks.bridge = bridge;

    await expect(loadDismissedWhatsNew()).resolves.toEqual([]);
  });

  it('falls back to an empty list when the bridge read throws, rather than blanking the screen', async () => {
    mocks.bridge = {
      getLocalStorage: vi.fn().mockRejectedValue(new Error('bridge unavailable')),
      setLocalStorage: vi.fn().mockResolvedValue(true),
    };

    await expect(loadDismissedWhatsNew()).resolves.toEqual([]);
  });

  it('a dismiss whose write fails does not throw', async () => {
    mocks.bridge = {
      getLocalStorage: vi.fn().mockResolvedValue(''),
      setLocalStorage: vi.fn().mockRejectedValue(new Error('bridge unavailable')),
    };

    await expect(dismissWhatsNew('context-menu')).resolves.toBeUndefined();
  });
});

describe('WHATS_NEW_ENTRY', () => {
  it('has at least one bullet describing the gesture change', () => {
    expect(WHATS_NEW_ENTRY.bullets.length).toBeGreaterThan(0);
    expect(WHATS_NEW_ENTRY.bullets.join(' ')).toMatch(/tap and hold/i);
  });
});
