/**
 * Paging through a list longer than MAX_LIST_ITEMS (20) — makeListScreen's
 * paging behavior. Exercised via the 'inbox' task screen since it needs no
 * project-selection setup, but the paging logic itself lives in the shared
 * factory and applies to every Tasks/Notes/Projects/Tags list screen.
 *
 * Paging beyond the first page is driven by tappable "◂ Prev"/"▸ More" rows
 * (SELECT_HIGHLIGHTED), not swipe — a native list's scroll-boundary events
 * turned out not to fire reliably in practice for a maxed-out list, so the
 * tap affordance is the only mechanism actually depended on. Swiping
 * (HIGHLIGHT_MOVE) is still wired as a no-cost bonus and covered too.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchInboxTasks } from '../../../api';
import { mount, move, select } from '../harness';

function tasks(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, name: `Task ${i + 1}` }));
}

// 45 items / 18-per-page (2 rows reserved for Prev/More) = pages of 18, 18, 9.
describe('a list screen with more than one page', () => {
  it('shows 18 real items plus a "More" row, and a "1/N" page indicator', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);

    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') {
      expect(display.items).toHaveLength(19);
      expect(display.items[0]).toBe('Task 1');
      expect(display.items[17]).toBe('Task 18');
      expect(display.items[18]).toBe('▸ More');
      expect(display.header).toContain('1/3');
    }
  });

  it('tapping "More" turns to the next page, which gets both Prev and More rows', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);

    h.dispatch(select(18)); // the "▸ More" row

    expect(h.state.listPages.inbox).toBe(1);
    const display = h.render();
    if (display.mode === 'list') {
      expect(display.items[0]).toBe('◂ Prev');
      expect(display.items[1]).toBe('Task 19');
      expect(display.items[18]).toBe('Task 36');
      expect(display.items[19]).toBe('▸ More');
      expect(display.header).toContain('2/3');
    }
  });

  it('tapping "More" again reaches the last (partial, no More row) page', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);

    h.dispatch(select(18)); // page 1 -> 2
    h.dispatch(select(19)); // page 2 -> 3 ("More" is now the last row, index 19)

    expect(h.state.listPages.inbox).toBe(2);
    const display = h.render();
    if (display.mode === 'list') {
      expect(display.items).toHaveLength(10); // Prev + 9 remaining items, no More
      expect(display.items[0]).toBe('◂ Prev');
      expect(display.items[1]).toBe('Task 37');
      expect(display.items[9]).toBe('Task 45');
      expect(display.header).toContain('3/3');
    }
  });

  it('tapping "Prev" on the last page goes back one page', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);
    h.state.listPages.inbox = 2;

    h.dispatch(select(0)); // the "◂ Prev" row

    expect(h.state.listPages.inbox).toBe(1);
  });

  it('selecting a real row on a later page resolves the correct underlying task', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);
    h.state.listPages.inbox = 1; // Prev, Task19..Task36, More

    h.dispatch(select(1)); // first real row after "◂ Prev" = "Task 19"

    expect(h.state.selectedTask?.taskId).toBe('t19');
    expect(h.state.selectedTask?.taskName).toBe('Task 19');
  });

  it('swiping down also turns the page, as a bonus when the firmware delivers it', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);

    h.dispatch(move('down'));

    expect(h.state.listPages.inbox).toBe(1);
  });

  it('swiping up at the first page is a no-op', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);

    h.dispatch(move('up'));

    expect(h.state.listPages.inbox ?? 0).toBe(0);
  });
});

describe('a list screen with a single page (<=20 items)', () => {
  it('shows no Prev/More rows and no page indicator — unchanged from before pagination', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(5);

    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') {
      expect(display.items).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5']);
      expect(display.header).not.toMatch(/\d\/\d/);
    }
  });

  it('swiping in either direction is a no-op', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(5);

    h.dispatch(move('down'));
    h.dispatch(move('up'));

    expect(h.state.listPages.inbox ?? 0).toBe(0);
    expect(h.state.screen).toBe('inbox');
  });

  it('a full 20-item page still shows no Prev/More rows', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(20);

    const display = h.render();
    if (display.mode === 'list') {
      expect(display.items).toHaveLength(20);
      expect(display.items).not.toContain('▸ More');
      expect(display.header).not.toMatch(/\d\/\d/);
    }
  });
});

describe('re-entering a list screen', () => {
  it('resets to the first page even if it was left on a later one', async () => {
    vi.mocked(fetchInboxTasks).mockResolvedValue({
      items: tasks(45),
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = tasks(45);
    h.state.listPages.inbox = 2;

    h.ctx.enterView('inbox');
    await h.settle();

    expect(h.state.listPages.inbox).toBe(0);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
