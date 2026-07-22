/**
 * Tags has no detail view — every tags list screen renders its fetched
 * items but a tap is inert (tags aren't in PROJECT_LIST_SCREENS or
 * NOTE_LIST_SCREENS, and there's no onSelect override).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { back, mount, select } from '../harness';

const TAG = { id: 'g1', name: 'urgent' };

describe('a tags list screen', () => {
  it('renders its fetched items, with the count in the header', () => {
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [TAG];

    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') {
      expect(display.items).toEqual(['urgent']);
      expect(display.header).toContain('TAGS A-Z (1)');
    }
  });

  it('shows the empty message when there are no tags', () => {
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [];

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain('No tags.');
  });

  it('tapping a tag row is a no-op — no selectedTask/Note/Project is set', () => {
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [TAG];

    h.dispatch(select(0));

    expect(h.state.screen).toBe('tags-a-z');
    expect(h.state.selectedTask).toBeNull();
    expect(h.state.selectedNote).toBeNull();
    expect(h.state.selectedProject).toBeNull();
  });

  it('GO_BACK returns to the tags menu', () => {
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [TAG];

    h.dispatch(back());

    expect(h.state.screen).toBe('tags-menu');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
