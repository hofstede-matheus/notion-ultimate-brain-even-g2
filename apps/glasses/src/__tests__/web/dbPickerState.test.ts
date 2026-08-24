/**
 * Sticky state for the settings database picker (web/services/config.ts) — which unfit
 * databases the user confirmed with "Save anyway", and whether "Show all databases" was left
 * on. Both live under their own storage key rather than in TenantConfig, which is base64'd
 * into the X-Notion-Config header of every request.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ bridge: null as unknown }));

vi.mock('../../state', () => ({
  getBridge: () => mocks.bridge,
}));

import {
  DEFAULT_PICKER_STATE,
  loadDbPickerState,
  saveDbPickerState,
} from '../../web/services/config';

const PICKER_KEY = 'notionultimatebrain:dbpicker';

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
  vi.stubGlobal('window', { localStorage: new Map() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDbPickerState', () => {
  it('defaults to no overrides and hidden extras when nothing is stored', async () => {
    mocks.bridge = fakeBridge();
    expect(await loadDbPickerState()).toEqual(DEFAULT_PICKER_STATE);
    expect(DEFAULT_PICKER_STATE).toEqual({ overrides: {}, showAll: false });
  });

  it('round-trips both fields through the bridge', async () => {
    mocks.bridge = fakeBridge();

    await saveDbPickerState({ overrides: { notesDb: 'notes-id' }, showAll: true });

    expect(await loadDbPickerState()).toEqual({
      overrides: { notesDb: 'notes-id' },
      showAll: true,
    });
  });

  it('falls back to window.localStorage when there is no bridge', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    });

    await saveDbPickerState({ overrides: { tagsDb: 'tags-id' }, showAll: true });

    expect(store.has(PICKER_KEY)).toBe(true);
    expect(await loadDbPickerState()).toEqual({ overrides: { tagsDb: 'tags-id' }, showAll: true });
  });

  it('returns the default on a malformed blob rather than throwing', async () => {
    const bridge = fakeBridge();
    bridge.store.set(PICKER_KEY, 'not json');
    mocks.bridge = bridge;

    expect(await loadDbPickerState()).toEqual(DEFAULT_PICKER_STATE);
  });

  it('ignores a non-boolean showAll and non-slot override keys', async () => {
    const bridge = fakeBridge();
    bridge.store.set(
      PICKER_KEY,
      JSON.stringify({
        overrides: { notesDb: 'notes-id', nonsenseDb: 'x', tagsDb: 42, projectsDb: '' },
        showAll: 'yes',
      }),
    );
    mocks.bridge = bridge;

    expect(await loadDbPickerState()).toEqual({
      overrides: { notesDb: 'notes-id' },
      showAll: false,
    });
  });

  it('treats an overrides field that is not an object as no overrides', async () => {
    const bridge = fakeBridge();
    bridge.store.set(PICKER_KEY, JSON.stringify({ overrides: 'nope', showAll: true }));
    mocks.bridge = bridge;

    expect(await loadDbPickerState()).toEqual({ overrides: {}, showAll: true });
  });
});
