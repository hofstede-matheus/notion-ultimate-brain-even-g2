/**
 * Root menu and submenu navigation (makeMenuScreen).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

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

  it("Add Task is a plain navigate, since it has no list fetcher", () => {
    const h = mount();
    h.state.screen = 'tasks-menu';

    h.dispatch(select(0)); // Add Task (Voice)

    expect(h.state.screen).toBe('add-task');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
