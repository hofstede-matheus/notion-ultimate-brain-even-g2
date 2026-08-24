/**
 * offline-queue.ts — failure classification, FIFO drain semantics, and the
 * persistence round trip. Mocks the two I/O leaves the module sits on
 * (even-toolkit/storage and ../api); the queue logic itself runs for real.
 */

import type { TenantConfig } from '@notion-ub/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { storageGet, storageSet } = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn().mockResolvedValue(undefined),
}));

const { createTask, onRequestSuccess, getTenantConfig } = vi.hoisted(() => ({
  createTask: vi.fn(),
  onRequestSuccess: vi.fn(),
  getTenantConfig: vi.fn<() => TenantConfig | null>(),
}));

vi.mock('even-toolkit/storage', () => ({ storageGet, storageSet }));
vi.mock('../tenant-config', () => ({ getTenantConfig }));
vi.mock('../api', () => ({
  createTask,
  onRequestSuccess,
  // Real class — classifyFailure narrows with `instanceof`, so identity matters.
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
}));

import { ApiError } from '../api';
import {
  __resetForTests,
  backoffMs,
  classifyFailure,
  clearQueue,
  discardQueued,
  drainQueue,
  enqueueTask,
  getQueue,
  loadQueue,
  MAX_ATTEMPTS,
  MAX_QUEUE_SIZE,
  notifyRequestSucceeded,
  queueStorageKey,
  startDraining,
  subscribeQueue,
} from '../offline-queue';

const tenantConfig = (tasksDb: string): TenantConfig => ({
  token: 'token',
  tasksDb,
  notesDb: 'notes',
  projectsDb: 'projects',
  tagsDb: 'tags',
});

beforeEach(() => {
  __resetForTests();
  getTenantConfig.mockReturnValue(tenantConfig('abcdefgh12345'));
  createTask.mockResolvedValue({ id: 't1', name: 'x' });
  storageGet.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('classifyFailure', () => {
  it.each([
    ['Chrome', new TypeError('Failed to fetch')],
    ['Chrome with host', new TypeError('Failed to fetch (example.com)')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari 16', new TypeError('The Internet connection appears to be offline.')],
    // The case a hand-rolled message check would miss — and the engine this
    // app actually ships into.
    ['WKWebView / Safari 17+', Object.assign(new TypeError('Load failed'), { stack: undefined })],
  ])('treats a %s transport failure as transient', (_engine, err) => {
    expect(classifyFailure(err)).toBe('transient');
  });

  it('treats an unrecognised TypeError as transient, since the Even WebView wording is undocumented', () => {
    expect(classifyFailure(new TypeError('some undocumented webview wording'))).toBe('transient');
  });

  it.each([500, 502, 503, 504, 429])('treats HTTP %i as transient', (status) => {
    expect(classifyFailure(new ApiError('boom', status))).toBe('transient');
  });

  it.each([400, 401, 403, 404, 422])('treats HTTP %i as permanent', (status) => {
    expect(classifyFailure(new ApiError('boom', status))).toBe('permanent');
  });

  it('never classifies an ApiError by the TypeError widening', () => {
    // ApiError extends Error, not TypeError — the ordering in classifyFailure
    // must hold even if that ever changes.
    expect(classifyFailure(new ApiError('bad request', 400, 'validation_error'))).toBe('permanent');
  });

  it.each([
    ['a plain Error', new Error('nope')],
    ['a string', 'nope'],
    ['null', null],
    ['undefined', undefined],
  ])('treats %s as permanent', (_label, err) => {
    expect(classifyFailure(err)).toBe('permanent');
  });
});

describe('backoffMs', () => {
  it('grows exponentially from 30s', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
  });

  it('caps at 15 minutes', () => {
    expect(backoffMs(50)).toBe(15 * 60_000);
  });

  it('does not go below the base delay for a zero attempt count', () => {
    expect(backoffMs(0)).toBe(30_000);
  });
});

describe('queueStorageKey', () => {
  it('is scoped to the tenant, so a workspace switch cannot post into the wrong database', () => {
    getTenantConfig.mockReturnValue(tenantConfig('aaa-workspace'));
    const keyA = queueStorageKey();
    getTenantConfig.mockReturnValue(tenantConfig('bbb-workspace'));
    expect(queueStorageKey()).not.toBe(keyA);
  });

  it('falls back to the unconfigured namespace', () => {
    getTenantConfig.mockReturnValue(null);
    expect(queueStorageKey()).toBe('notionultimatebrain:unconfigured:queue');
  });
});

describe('enqueueTask', () => {
  it('appends the transcript and mirrors the queue to storage', async () => {
    const entry = await enqueueTask('buy oat milk');

    expect(entry.name).toBe('buy oat milk');
    expect(entry.attempts).toBe(0);
    expect(getQueue()).toEqual([entry]);
    expect(storageSet).toHaveBeenCalledWith(
      'notionultimatebrain:abcdefgh:queue',
      expect.arrayContaining([expect.objectContaining({ name: 'buy oat milk' })]),
    );
  });

  it('preserves insertion order', async () => {
    await enqueueTask('first');
    await enqueueTask('second');
    expect(getQueue().map((e) => e.name)).toEqual(['first', 'second']);
  });

  it('gives entries distinct ids', async () => {
    const a = await enqueueTask('one');
    const b = await enqueueTask('two');
    expect(a.id).not.toBe(b.id);
  });

  it('notifies subscribers', async () => {
    const listener = vi.fn();
    subscribeQueue(listener);
    await enqueueTask('buy oat milk');
    expect(listener).toHaveBeenCalled();
  });

  it('drops the oldest entries past the size cap rather than rejecting the new recording', async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) await enqueueTask(`task ${i}`);
    await enqueueTask('newest');

    const queue = getQueue();
    expect(queue).toHaveLength(MAX_QUEUE_SIZE);
    expect(queue[queue.length - 1].name).toBe('newest');
    expect(queue[0].name).toBe('task 1');
  });
});

describe('getQueue snapshot identity', () => {
  it('returns a stable reference between changes, so useSyncExternalStore does not loop', async () => {
    await enqueueTask('buy oat milk');
    expect(getQueue()).toBe(getQueue());
  });

  it('returns a new reference after a change', async () => {
    await enqueueTask('first');
    const before = getQueue();
    await enqueueTask('second');
    expect(getQueue()).not.toBe(before);
  });
});

describe('loadQueue', () => {
  it('rehydrates the buffer from storage', async () => {
    storageGet.mockResolvedValue([{ id: 'a', name: 'buy oat milk', queuedAt: 1, attempts: 0 }]);

    await loadQueue();

    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].name).toBe('buy oat milk');
  });

  it('ignores a non-array entry', async () => {
    storageGet.mockResolvedValue({ not: 'a queue' });
    await loadQueue();
    expect(getQueue()).toEqual([]);
  });

  it('filters out malformed records rather than trusting the blob wholesale', async () => {
    storageGet.mockResolvedValue([
      { id: 'a', name: 'good', queuedAt: 1, attempts: 0 },
      { id: 'b' },
      null,
      'nonsense',
    ]);

    await loadQueue();

    expect(getQueue().map((e) => e.name)).toEqual(['good']);
  });

  it('survives a storage failure without throwing', async () => {
    storageGet.mockRejectedValue(new Error('bridge down'));
    await expect(loadQueue()).resolves.toBeUndefined();
    expect(getQueue()).toEqual([]);
  });
});

describe('drainQueue', () => {
  it('sends queued tasks oldest-first and empties the queue', async () => {
    await enqueueTask('first');
    await enqueueTask('second');

    await drainQueue('test');

    expect(createTask.mock.calls.map((c) => c[0])).toEqual(['first', 'second']);
    expect(getQueue()).toEqual([]);
  });

  it('does nothing on an empty queue — not even a storage write', async () => {
    await drainQueue('test');
    expect(createTask).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('aborts the whole pass on a transient failure — the rest cannot reach the server either', async () => {
    await enqueueTask('first');
    await enqueueTask('second');
    createTask.mockRejectedValue(new TypeError('Load failed'));

    await drainQueue('test');

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(getQueue().map((e) => e.name)).toEqual(['first', 'second']);
    expect(getQueue()[0].attempts).toBe(1);
    expect(getQueue()[1].attempts).toBe(0);
  });

  it('persists the bumped attempt count even when nothing was sent', async () => {
    await enqueueTask('first');
    storageSet.mockClear();
    createTask.mockRejectedValue(new TypeError('Load failed'));

    await drainQueue('test');

    expect(storageSet).toHaveBeenCalledWith(
      'notionultimatebrain:abcdefgh:queue',
      expect.arrayContaining([expect.objectContaining({ attempts: 1 })]),
    );
  });

  it('keeps going past a permanent failure — it is specific to that one entry', async () => {
    await enqueueTask('bad');
    await enqueueTask('good');
    createTask.mockRejectedValueOnce(new ApiError('bad request', 400)).mockResolvedValue({});

    await drainQueue('test');

    expect(createTask).toHaveBeenCalledTimes(2);
    expect(getQueue().map((e) => e.name)).toEqual(['bad']);
    expect(getQueue()[0].attempts).toBe(1);
  });

  it('records the failure message so the phone can show why', async () => {
    await enqueueTask('bad');
    createTask.mockRejectedValue(new ApiError('Request failed with status 400', 400));

    await drainQueue('test');

    expect(getQueue()[0].lastError).toBe('Request failed with status 400');
  });

  it('parks an entry as failed after MAX_ATTEMPTS instead of retrying it forever', async () => {
    await enqueueTask('doomed');
    createTask.mockRejectedValue(new ApiError('bad request', 400));

    for (let i = 0; i < MAX_ATTEMPTS; i++) await drainQueue('test');

    expect(getQueue()[0].failed).toBe(true);
    expect(getQueue()[0].attempts).toBe(MAX_ATTEMPTS);
  });

  it('never silently drops a failed transcript — it stays queued for the user to see', async () => {
    await enqueueTask('doomed');
    createTask.mockRejectedValue(new ApiError('bad request', 400));

    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) await drainQueue('test');

    expect(getQueue().map((e) => e.name)).toEqual(['doomed']);
  });

  it('skips entries already given up on', async () => {
    await enqueueTask('doomed');
    createTask.mockRejectedValue(new ApiError('bad request', 400));
    for (let i = 0; i < MAX_ATTEMPTS; i++) await drainQueue('test');
    createTask.mockClear();
    createTask.mockResolvedValue({});

    await drainQueue('test');

    expect(createTask).not.toHaveBeenCalled();
  });

  it('is single-flight — concurrent triggers collapse into one pass', async () => {
    await enqueueTask('first');
    let release: () => void = () => {};
    createTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({});
        }),
    );

    const a = drainQueue('trigger a');
    const b = drainQueue('trigger b');
    release();
    await Promise.all([a, b]);

    expect(createTask).toHaveBeenCalledTimes(1);
  });
});

describe('notifyRequestSucceeded', () => {
  it('drains when something is queued', async () => {
    await enqueueTask('buy oat milk');
    notifyRequestSucceeded();
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledWith('buy oat milk'));
  });

  it('is a no-op on an empty queue, so every successful request stays cheap', () => {
    notifyRequestSucceeded();
    expect(createTask).not.toHaveBeenCalled();
  });
});

describe('startDraining', () => {
  it('registers the api success hook so a 2xx can trigger a drain', () => {
    startDraining();
    expect(onRequestSuccess).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — boot can retry connect()', () => {
    startDraining();
    startDraining();
    expect(onRequestSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('removal', () => {
  it('discardQueued removes just that entry', async () => {
    const a = await enqueueTask('first');
    await enqueueTask('second');

    await discardQueued(a.id);

    expect(getQueue().map((e) => e.name)).toEqual(['second']);
  });

  it('discardQueued is a no-op for an unknown id', async () => {
    await enqueueTask('first');
    storageSet.mockClear();

    await discardQueued('nope');

    expect(getQueue()).toHaveLength(1);
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('clearQueue empties everything', async () => {
    await enqueueTask('first');
    await enqueueTask('second');

    await clearQueue();

    expect(getQueue()).toEqual([]);
    expect(storageSet).toHaveBeenCalledWith('notionultimatebrain:abcdefgh:queue', []);
  });
});

describe('the backoff retry timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on its own once the backoff elapses', async () => {
    await enqueueTask('buy oat milk');
    createTask.mockRejectedValue(new TypeError('Load failed'));
    await drainQueue('test');
    expect(createTask).toHaveBeenCalledTimes(1);

    createTask.mockResolvedValue({});
    await vi.advanceTimersByTimeAsync(backoffMs(1));

    expect(createTask).toHaveBeenCalledTimes(2);
    expect(getQueue()).toEqual([]);
  });

  it('does not retry before the backoff elapses', async () => {
    await enqueueTask('buy oat milk');
    createTask.mockRejectedValue(new TypeError('Load failed'));
    await drainQueue('test');

    await vi.advanceTimersByTimeAsync(backoffMs(1) - 1000);

    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('arms only one timer, so repeated failures do not stack retries', async () => {
    await enqueueTask('buy oat milk');
    createTask.mockRejectedValue(new TypeError('Load failed'));

    await drainQueue('first');
    await drainQueue('second');
    await drainQueue('third');
    expect(createTask).toHaveBeenCalledTimes(3);

    // Three drains armed at most one timer, so one backoff window produces
    // exactly one extra attempt. Three stacked timers would produce three.
    await vi.advanceTimersByTimeAsync(backoffMs(1));

    expect(createTask).toHaveBeenCalledTimes(4);
  });

  it('backs off further after each successive failure', async () => {
    await enqueueTask('buy oat milk');
    createTask.mockRejectedValue(new TypeError('Load failed'));
    await drainQueue('test');

    // attempts is now 1 -> the retry fires at backoffMs(1) and fails again,
    // so the next one must wait the longer backoffMs(2), not backoffMs(1).
    await vi.advanceTimersByTimeAsync(backoffMs(1));
    expect(createTask).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(backoffMs(1));
    expect(createTask).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(backoffMs(2));
    expect(createTask).toHaveBeenCalledTimes(3);
  });

  it('schedules nothing after a permanent failure — there is nothing to wait for', async () => {
    await enqueueTask('bad');
    createTask.mockRejectedValue(new ApiError('bad request', 400));
    await drainQueue('test');

    await vi.advanceTimersByTimeAsync(backoffMs(MAX_ATTEMPTS));

    expect(createTask).toHaveBeenCalledTimes(1);
  });
});

describe('queue size boundary', () => {
  it('keeps every entry at exactly the cap', async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) await enqueueTask(`task ${i}`);

    expect(getQueue()).toHaveLength(MAX_QUEUE_SIZE);
    expect(getQueue()[0].name).toBe('task 0');
  });
});

describe('notification', () => {
  it('loadQueue notifies subscribers so the phone re-renders on a restored queue', async () => {
    storageGet.mockResolvedValue([{ id: 'a', name: 'buy oat milk', queuedAt: 1, attempts: 0 }]);
    const listener = vi.fn();
    subscribeQueue(listener);

    await loadQueue();

    expect(listener).toHaveBeenCalled();
  });

  it('loadQueue does not notify when there was nothing stored', async () => {
    const listener = vi.fn();
    subscribeQueue(listener);

    await loadQueue();

    expect(listener).not.toHaveBeenCalled();
  });

  it('loadQueue does not notify for a stored-but-empty queue', async () => {
    storageGet.mockResolvedValue([]);
    const listener = vi.fn();
    subscribeQueue(listener);

    await loadQueue();

    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribing stops further notifications', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQueue(listener);
    unsubscribe();

    await enqueueTask('buy oat milk');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('no-op guards', () => {
  it('clearQueue does not touch storage when already empty', async () => {
    await clearQueue();
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('notifyRequestSucceeded does not start a second pass mid-drain', async () => {
    await enqueueTask('first');
    let release: () => void = () => {};
    createTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({});
        }),
    );

    const pass = drainQueue('test');
    notifyRequestSucceeded();
    release();
    await pass;

    expect(createTask).toHaveBeenCalledTimes(1);
  });
});
