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

import type { DeviceStatus, EvenHubEvent, LaunchSource } from '@evenrealities/even_hub_sdk';
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
  'fetchAllProjects',
  'fetchDoingProjects',
  'fetchOngoingProjects',
  'fetchPlannedProjects',
  'fetchOnHoldProjects',
  'fetchDoneProjects',
  'fetchBoardProjects',
  'fetchArchivedProjects',
  'fetchRecentTags',
  'fetchFavoriteTags',
  'fetchAToZTags',
  'fetchAreaTags',
  'fetchResourceTags',
  'fetchEntityTags',
  'fetchProjectTasksTodo',
  'fetchProjectTasksDone',
  'fetchNotesForProject',
  'fetchNotesForTag',
] as const;

/** Every api.ts export as a vi.fn(), list fetchers defaulted to an empty single page. */
export function apiMock(): ApiModule {
  const base = Object.fromEntries(
    LIST_FETCHERS.map((name) => [
      name,
      vi.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
    ]),
  ) as Record<(typeof LIST_FETCHERS)[number], ReturnType<typeof vi.fn>>;

  return {
    ...base,
    createTask: vi.fn(async (name: string) => ({ id: 't1', name })),
    markTaskDone: vi.fn().mockResolvedValue(undefined),
    setTaskDueDate: vi.fn().mockResolvedValue(undefined),
    setPageProject: vi.fn().mockResolvedValue(undefined),
    deletePage: vi.fn().mockResolvedValue(undefined),
    fetchPageDetails: vi.fn().mockResolvedValue({ project: null, due: null }),
    fetchPageMarkdown: vi.fn().mockResolvedValue({ markdown: '', truncated: false }),
    fetchPage: vi.fn().mockResolvedValue({ properties: {} }),
    // Not stubbed with vi.fn() — config-health.ts's `err instanceof ApiError` check needs the
    // real class identity, and a plain `class extends Error` has no behaviour worth mocking.
    ApiError: class ApiError extends Error {
      constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
      ) {
        super(message);
        this.name = 'ApiError';
      }
    },
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
  /** Simulates the backend delivering its (possibly empty) transcription. */
  fireFinal(text: string): void;
  /** Simulates VAD auto-stop (mic closes, UI moves to "processing"). */
  fireStop(): void;
  /** Controls what the next ensureReady() call resolves to. */
  setReady(ready: boolean): void;
  /**
   * Clears session state between tests. vi.clearAllMocks() only resets the
   * vi.fn call records, not the closure the fake keeps, so without this a test
   * that started a recording leaves the next one thinking the mic is open.
   */
  reset(): void;
}

/**
 * stt/ façade mock — captures the onFinal/onStop passed to startListening so a
 * test can fire them. Backend-agnostic: the façade looks the same whichever
 * provider is active.
 */
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
    ensureReady: vi.fn(async () => ready),
    applyVoiceConfig: vi.fn(async () => 'ready'),
    warmUp: vi.fn(async () => ready),
    startListening: vi.fn((final: (text: string) => void, stop?: () => void) => {
      listening = true;
      onFinal = final;
      onStop = stop ?? null;
    }),
    stopListening,
    isListening: vi.fn(() => listening),
    feedAudio: vi.fn(),
    dispose: vi.fn(),
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
    reset() {
      ready = true;
      listening = false;
      onFinal = null;
      onStop = null;
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
    // The real SDK returns an unsubscribe function from each on*() listener.
    // Typed callback params so tests can index bridge.on*().mock.calls[i][0].
    onEvenHubEvent: vi.fn((_cb: (e: EvenHubEvent) => void) => () => {}),
    onDeviceStatusChanged: vi.fn((_cb: (s: DeviceStatus) => void) => () => {}),
    onLaunchSource: vi.fn((_cb: (s: LaunchSource) => void) => () => {}),
    updateImageRawData: vi.fn().mockResolvedValue('success'),
  };
}

export type MockBridge = ReturnType<typeof makeMockBridge>;
