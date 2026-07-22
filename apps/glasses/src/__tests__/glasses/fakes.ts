/**
 * Shared vi.mock factories for the three I/O modules every flow test mocks
 * (api, cache, stt), plus the bridge stub. Each test file does:
 *
 *   vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
 *
 * — an async dynamic import inside the factory, since vi.mock's factory runs
 * before the test file's own top-level imports are usable (a plain import of
 * these helpers can't be referenced from inside vi.mock/vi.hoisted directly).
 */

import { vi } from 'vitest';

type ApiModule = typeof import('../../api');
type CacheModule = typeof import('../../cache');
type SttModule = typeof import('../../stt');

const LIST_FETCHERS = [
  'fetchTodayTasks',
  'fetchInboxTasks',
  'fetchNext7DaysTasks',
  'fetchTomorrowTasks',
  'fetchInboxNotes',
  'fetchFavoriteNotes',
  'fetchByTagNotes',
  'fetchNotes',
  'fetchMeetingNotes',
  'fetchByProjectNotes',
  'fetchClipsNotes',
  'fetchVoiceNotes',
  'fetchJournalNotes',
  'fetchAllNotes',
  'fetchActiveProjects',
  'fetchPlannedProjects',
  'fetchBoardProjects',
  'fetchArchivedProjects',
  'fetchRecentTags',
  'fetchFavoriteTags',
  'fetchAToZTags',
  'fetchTypeTags',
  'fetchTasksForProject',
  'fetchNotesForProject',
] as const;

/** Every api.ts export as a vi.fn(), list fetchers defaulted to an empty array. */
export function apiMock(): ApiModule {
  const base = Object.fromEntries(
    LIST_FETCHERS.map((name) => [name, vi.fn().mockResolvedValue([])]),
  ) as Record<(typeof LIST_FETCHERS)[number], ReturnType<typeof vi.fn>>;

  return {
    ...base,
    createTask: vi.fn(async (name: string) => ({ id: 't1', name })),
    markTaskDone: vi.fn().mockResolvedValue(undefined),
    deletePage: vi.fn().mockResolvedValue(undefined),
    fetchPageMetadata: vi.fn().mockResolvedValue({ project: null, due: null }),
    fetchPageMarkdown: vi.fn().mockResolvedValue({ markdown: '', truncated: false }),
    fetchPage: vi.fn().mockResolvedValue({ properties: {} }),
  } as unknown as ApiModule;
}

/** cache.ts mock — cacheKeyForScreen stays a real function (navigation derives keys from it). */
export function cacheMock(): CacheModule {
  return {
    loadCachedList: vi.fn().mockResolvedValue(null),
    saveCachedList: vi.fn().mockResolvedValue(undefined),
    cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
  } as unknown as CacheModule;
}

export interface SttController {
  /** Simulates Vosk delivering its (possibly empty) transcription. */
  fireFinal(text: string): void;
  /** Simulates VAD auto-stop (mic closes, UI moves to "processing"). */
  fireStop(): void;
  /** Controls what the next ensureRecognizer() call resolves to. */
  setReady(ready: boolean): void;
}

/** stt.ts mock — captures the onFinal/onStop passed to startListening so a test can fire them. */
export function sttMock(): SttModule & SttController {
  let ready = true;
  let listening = false;
  let onFinal: ((text: string) => void) | null = null;
  let onStop: (() => void) | null = null;

  const stopListening = vi.fn(() => {
    if (!listening) return;
    listening = false;
    onStop?.();
  });

  return {
    ensureRecognizer: vi.fn(async () => ready),
    startListening: vi.fn((final: (text: string) => void, stop?: () => void) => {
      listening = true;
      onFinal = final;
      onStop = stop ?? null;
    }),
    stopListening,
    isListening: vi.fn(() => listening),
    feedAudio: vi.fn(),
    preloadVoskModel: vi.fn(),
    fireFinal(text: string) {
      const cb = onFinal;
      onFinal = null;
      cb?.(text);
    },
    fireStop() {
      listening = false;
      onStop?.();
    },
    setReady(r: boolean) {
      ready = r;
    },
  } as unknown as SttModule & SttController;
}

/** vi.fn stubs for every EvenAppBridge method render/events touch. */
export function makeMockBridge() {
  return {
    createStartUpPageContainer: vi.fn().mockResolvedValue(0),
    rebuildPageContainer: vi.fn().mockResolvedValue(true),
    textContainerUpgrade: vi.fn().mockResolvedValue(true),
    shutDownPageContainer: vi.fn().mockResolvedValue(true),
    audioControl: vi.fn().mockResolvedValue(true),
    setLocalStorage: vi.fn().mockResolvedValue(true),
    getLocalStorage: vi.fn().mockResolvedValue(''),
    onEvenHubEvent: vi.fn(),
  };
}

export type MockBridge = ReturnType<typeof makeMockBridge>;
