/**
 * The status screen's "what's new" card (web/whats-new.ts) — the pure shouldShowWhatsNew check
 * and seen-version persistence. Same bridge/localStorage-fallback shape as services/config.ts's
 * db-picker state, under its own storage key rather than TenantConfig.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ bridge: null as unknown }));

vi.mock('../../state', () => ({
  getBridge: () => mocks.bridge,
}));

import {
  APP_VERSION,
  dismissWhatsNew,
  loadSeenWhatsNewVersion,
  RELEASE_NOTES,
  shouldShowWhatsNew,
} from '../../web/whats-new';

const STORAGE_KEY = 'notionultimatebrain:whatsnew-seen-version';
const NOTES = { version: '2.12.0', groups: [{ heading: 'Features', bullets: ['tasks: x'] }] };

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

describe('shouldShowWhatsNew', () => {
  it('shows when nothing has been dismissed yet', () => {
    expect(shouldShowWhatsNew(NOTES, '2.12.0', null)).toBe(true);
  });

  it('hides once the current version has been dismissed', () => {
    expect(shouldShowWhatsNew(NOTES, '2.12.0', '2.12.0')).toBe(false);
  });

  it('shows again once the version changes after a dismissal', () => {
    expect(shouldShowWhatsNew(NOTES, '2.12.0', '2.11.0')).toBe(true);
  });

  it('hides when the build carries no notes, or notes with no groups', () => {
    expect(shouldShowWhatsNew(null, '2.12.0', null)).toBe(false);
    expect(shouldShowWhatsNew({ version: '2.12.0', groups: [] }, '2.12.0', null)).toBe(false);
  });
});

describe('baked-in build constants', () => {
  it('reads the notes and version vite defines (vitest.config.ts fixture)', () => {
    expect(APP_VERSION).toBe('test');
    expect(RELEASE_NOTES?.version).toBe('test');
    expect(RELEASE_NOTES?.groups.map((g) => g.heading)).toEqual(['Features', 'Bug Fixes']);
  });
});

describe('loadSeenWhatsNewVersion / dismissWhatsNew', () => {
  it('is null when nothing is stored', async () => {
    mocks.bridge = fakeBridge();
    expect(await loadSeenWhatsNewVersion()).toBeNull();
  });

  it('round-trips a dismissed version through the bridge', async () => {
    const bridge = fakeBridge();
    mocks.bridge = bridge;

    await dismissWhatsNew('2.12.0');

    expect(await loadSeenWhatsNewVersion()).toBe('2.12.0');
    expect(bridge.setLocalStorage).toHaveBeenCalledWith(STORAGE_KEY, '2.12.0');
  });

  it('a later dismissal replaces the earlier version', async () => {
    mocks.bridge = fakeBridge();

    await dismissWhatsNew('2.11.0');
    await dismissWhatsNew('2.12.0');

    expect(await loadSeenWhatsNewVersion()).toBe('2.12.0');
  });

  it('ignores the old dismissed-ids key, so the first versioned build shows its notes once', async () => {
    const bridge = fakeBridge();
    bridge.store.set('notionultimatebrain:whatsnew-dismissed', JSON.stringify(['context-menu']));
    mocks.bridge = bridge;

    expect(await loadSeenWhatsNewVersion()).toBeNull();
  });

  it('falls back to null when the bridge read throws, rather than blanking the screen', async () => {
    mocks.bridge = {
      getLocalStorage: vi.fn().mockRejectedValue(new Error('bridge unavailable')),
      setLocalStorage: vi.fn().mockResolvedValue(true),
    };

    await expect(loadSeenWhatsNewVersion()).resolves.toBeNull();
  });

  it('falls back to null when localStorage throws and there is no bridge', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
      },
    });

    await expect(loadSeenWhatsNewVersion()).resolves.toBeNull();
  });

  it('a dismiss whose write fails does not throw', async () => {
    mocks.bridge = {
      getLocalStorage: vi.fn().mockResolvedValue(''),
      setLocalStorage: vi.fn().mockRejectedValue(new Error('bridge unavailable')),
    };

    await expect(dismissWhatsNew('2.12.0')).resolves.toBeUndefined();
  });
});
