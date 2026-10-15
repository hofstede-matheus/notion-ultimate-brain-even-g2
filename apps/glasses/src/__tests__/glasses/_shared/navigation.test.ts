/**
 * enterView() — the generic cache-then-fetch pipeline behind every
 * Tasks/Notes/Projects/Tags list screen. Exercised directly via ctx.enterView
 * rather than through a menu tap, since it's shared infrastructure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchInboxTasks, fetchProjectTasksTodo } from '../../../api';
import { loadCachedList, saveCachedList } from '../../../cache';
import { clear as clearLog, getSnapshot as getLogSnapshot } from '../../../logging/sink';
import { mount } from '../harness';

const CACHE_KEY = 'notionultimatebrain:inbox';
const CACHED = [{ id: 'c1', name: 'Cached task' }];
const FRESH = [{ id: 'f1', name: 'Fresh task' }];

/** A promise that never settles — for inspecting the mid-flight state. */
function pending<T>() {
  return new Promise<T>(() => {});
}

function seedCache(items: typeof CACHED) {
  vi.mocked(loadCachedList).mockImplementation(async (key: string) =>
    key === CACHE_KEY ? items : null,
  );
}

describe('cold open (no prior cache)', () => {
  it('shows a loading placeholder before the fetch resolves, then the fresh list', async () => {
    vi.mocked(fetchInboxTasks).mockReturnValue(pending());
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.screen).toBe('inbox');
    expect(h.state.loading).toBe(true);
    expect(h.state.spinnerFrame).not.toBe('');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain('Fetching tasks...');
  });
});

describe('warm open (cache hit)', () => {
  it('shows the cached list immediately, before the fetch resolves', async () => {
    seedCache(CACHED);
    vi.mocked(fetchInboxTasks).mockReturnValue(pending());
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.loading).toBe(false);
    expect(h.state.lists.inbox).toEqual(CACHED);
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Cached task'] });
  });
});

describe('failed fetch on cold open', () => {
  it('shows a load-failed message instead of the empty state or "Fetching…"', async () => {
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.loading).toBe(false);
    expect(h.state.lists.inbox).toEqual([]);
    expect(h.state.listStatus.inbox).toBe('failed');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain("Couldn't load");
      expect(display.content).not.toContain('Your inbox is empty!');
      expect(display.content).not.toContain('Fetching tasks...');
    }
  });

  it('logs an error record instead of failing silently', async () => {
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    const errorRecords = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errorRecords).toHaveLength(1);
    expect(errorRecords[0]?.ctx?.error).toContain('offline');
  });

  it('a later success clears the failed marker', async () => {
    vi.mocked(fetchInboxTasks).mockRejectedValueOnce(new Error('offline'));
    const h = mount();
    h.state.screen = 'tasks-menu';
    h.ctx.enterView('inbox');
    await h.settle();
    expect(h.state.listStatus.inbox).toBe('failed');

    vi.mocked(fetchInboxTasks).mockResolvedValue({
      items: FRESH,
      hasMore: false,
      nextCursor: null,
    });
    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.listStatus.inbox).toBeUndefined();
  });
});

describe('failed fetch on warm open', () => {
  it('keeps the cached list visible, but marks it stale', async () => {
    seedCache(CACHED);
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.lists.inbox).toEqual(CACHED);
    expect(h.state.listStatus.inbox).toBe('stale');
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('old');
  });

  it('a later success clears the stale marker', async () => {
    seedCache(CACHED);
    vi.mocked(fetchInboxTasks).mockRejectedValueOnce(new Error('offline'));
    const h = mount();
    h.state.screen = 'tasks-menu';
    h.ctx.enterView('inbox');
    await h.settle();
    expect(h.state.listStatus.inbox).toBe('stale');

    vi.mocked(fetchInboxTasks).mockResolvedValue({
      items: FRESH,
      hasMore: false,
      nextCursor: null,
    });
    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.listStatus.inbox).toBeUndefined();
    const display = h.render();
    if (display.mode === 'list') expect(display.header).not.toContain('old');
  });
});

describe('successful background fetch', () => {
  it('saves the fresh data under the list-view cache key', async () => {
    seedCache(CACHED);
    vi.mocked(fetchInboxTasks).mockResolvedValue({
      items: FRESH,
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.lists.inbox).toEqual(FRESH);
    expect(saveCachedList).toHaveBeenCalledWith(CACHE_KEY, FRESH);
  });

  it('stops the spinner once the fetch settles', async () => {
    vi.mocked(fetchInboxTasks).mockResolvedValue({
      items: FRESH,
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.spinnerFrame).toBe('');
  });
});

describe('a screen with no registered fetcher', () => {
  it('is a no-op — stays on the current screen', async () => {
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.ctx.enterView('add-task');
    await h.settle();

    expect(h.state.screen).toBe('tasks-menu');
  });
});

describe('project-scoped list fetchers forward the retry deadline', () => {
  // VIEW_FETCHERS' project/tag entries are inline closures, not direct api references —
  // widening the fetcher signature to add an optional `opts` param compiles even if a
  // closure forgets to forward it (fewer params is always assignable to a wider function
  // type), so this has to be pinned by a test, not just check-types.
  it("project-tasks-todo's closure forwards opts (and thus the shared deadline) to the fetcher", async () => {
    vi.mocked(fetchProjectTasksTodo).mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.selectedProject = { id: 'p1', name: 'Project', returnTo: 'projects-board' };

    h.ctx.enterView('project-tasks-todo');
    await h.settle();

    expect(fetchProjectTasksTodo).toHaveBeenCalledWith('p1', undefined, {
      deadline: expect.any(Number),
    });
  });
});

beforeEach(() => {
  vi.mocked(loadCachedList).mockResolvedValue(null);
  clearLog();
});

afterEach(() => {
  vi.clearAllMocks();
});
