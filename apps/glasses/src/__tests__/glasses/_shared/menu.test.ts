/**
 * Root menu and submenu navigation (makeMenuScreen).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { MAX_LIST_ITEMS, makeMenuScreen } from '../../../glasses/modules/_shared/screen-factories';
import type { GlassCtx } from '../../../glasses/types';
import { clear as clearLog, getSnapshot as getLogSnapshot } from '../../../logging/sink';
import { back, mount, select } from '../harness';

describe('root menu', () => {
  it('renders the four top-level categories in order', () => {
    const h = mount();
    h.state.screen = 'menu';

    expect(h.render()).toMatchObject({
      mode: 'list',
      items: ['Tasks', 'Notes', 'Projects', 'Tags'],
    });
  });

  it('selecting a category opens its submenu', () => {
    const h = mount();
    h.state.screen = 'menu';

    h.dispatch(select(1)); // Notes

    expect(h.state.screen).toBe('notes-menu');
  });

  it('logs a SEL record followed by a NAV record, in order', () => {
    clearLog();
    const h = mount();
    h.state.screen = 'menu';

    h.dispatch(select(1)); // Notes

    const records = getLogSnapshot();
    const selIndex = records.findIndex((r) => r.cat === 'SEL');
    const navTransitionIndex = records.findIndex((r) => r.cat === 'NAV' && r.msg.includes('->'));
    expect(selIndex).toBeGreaterThanOrEqual(0);
    expect(navTransitionIndex).toBeGreaterThan(selIndex);
  });

  it('GO_BACK at the root shuts the app down', () => {
    const h = mount();
    h.state.screen = 'menu';

    h.dispatch(back());

    expect(h.bridge.shutDownPageContainer).toHaveBeenCalledWith(1);
  });
});

describe('a submenu', () => {
  it('GO_BACK returns to the root menu', () => {
    const h = mount();
    h.state.screen = 'notes-menu';

    h.dispatch(back());

    expect(h.state.screen).toBe('menu');
  });

  it('selecting a plain list item enters the cache-then-fetch pipeline', async () => {
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.dispatch(select(1)); // Today
    await h.settle();

    expect(h.state.screen).toBe('today');
  });

  it('Add Task is a plain navigate, since it has no list fetcher', () => {
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.dispatch(select(0)); // Add Task (Voice)

    expect(h.state.screen).toBe('add-task');
  });
});

describe('projects list screens', () => {
  it('the projects menu lists all status filters', () => {
    const h = mount();
    h.state.screen = 'projects-menu';

    expect(h.render()).toMatchObject({
      mode: 'list',
      items: ['Doing', 'Ongoing', 'Planned', 'On Hold', 'Done', 'Archived'],
    });
  });

  it('each status filter enters the cache-then-fetch pipeline', async () => {
    const h = mount();
    h.state.screen = 'projects-menu';

    h.dispatch(select(0)); // Doing
    await h.settle();
    expect(h.state.screen).toBe('projects-doing');

    h.state.screen = 'projects-menu';
    h.dispatch(select(1)); // Ongoing
    await h.settle();
    expect(h.state.screen).toBe('projects-ongoing');

    h.state.screen = 'projects-menu';
    h.dispatch(select(2)); // Planned
    await h.settle();
    expect(h.state.screen).toBe('projects-planned');

    h.state.screen = 'projects-menu';
    h.dispatch(select(3)); // On Hold
    await h.settle();
    expect(h.state.screen).toBe('projects-on-hold');

    h.state.screen = 'projects-menu';
    h.dispatch(select(4)); // Done
    await h.settle();
    expect(h.state.screen).toBe('projects-done');
  });
});

describe('makeMenuScreen truncation guards (F16)', () => {
  it('truncates an oversized label to the list row width', () => {
    const longLabel = 'A'.repeat(120);
    const screen = makeMenuScreen({ title: 'TEST', items: [{ label: longLabel, target: 'menu' }] });

    const display = screen.display(mount().state);

    expect(display.mode).toBe('list');
    if (display.mode === 'list') {
      expect(display.items[0]).not.toBe(longLabel);
      expect(display.items[0]?.endsWith('...')).toBe(true);
    }
  });

  it('caps the displayed items at MAX_LIST_ITEMS, without breaking selection routing', () => {
    const items = Array.from({ length: MAX_LIST_ITEMS + 5 }, (_, i) => ({
      label: `Item ${i}`,
      target: 'menu' as const,
    }));
    const screen = makeMenuScreen({ title: 'TEST', items });
    const h = mount();

    const display = screen.display(h.state);
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.items).toHaveLength(MAX_LIST_ITEMS);

    // Index 3 must resolve against the same row shown on screen — i.e. the
    // slice used for display and the array indexed by SELECT_HIGHLIGHTED
    // must agree on ordering, even though only the first MAX_LIST_ITEMS of
    // `items` are ever rendered.
    const navigate = vi.fn();
    const ctx = { navigate } as unknown as GlassCtx;
    screen.action({ type: 'SELECT_HIGHLIGHTED', itemIndex: 3 }, h.state, ctx);

    expect(navigate).toHaveBeenCalledWith('menu');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
