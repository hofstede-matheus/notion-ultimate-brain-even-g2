/**
 * Tapping a tag opens the tag-scoped notes list — dynamic "TAG: <name>"
 * header, GO_BACK returns to whichever tags list screen the tap came from,
 * and tapping a note routes into the standard note-actions menu.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchNotesForTag } from '../../../api';
import { back, mount, select } from '../harness';

const TAG = { id: 'g1', name: 'urgent' };

describe('tapping a tag', () => {
  it('fetches and shows that tag\'s notes, with a "TAG: <name>" header', async () => {
    vi.mocked(fetchNotesForTag).mockResolvedValue({
      items: [{ id: 'n1', name: 'Design notes' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [TAG];

    h.dispatch(select(0));
    await h.settle();

    expect(fetchNotesForTag).toHaveBeenCalledWith('g1', undefined);
    expect(h.state.screen).toBe('tag-notes');
    expect(h.state.lists['tag-notes']).toEqual([{ id: 'n1', name: 'Design notes' }]);
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('TAG: urgent');
  });

  it('GO_BACK returns to the tags list screen the tag was opened from', async () => {
    const h = mount();
    h.state.screen = 'tags-favorites';
    h.state.lists['tags-favorites'] = [TAG];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.screen).toBe('tags-favorites');
  });

  it('tapping a note in the tag-notes list opens the note action menu', async () => {
    vi.mocked(fetchNotesForTag).mockResolvedValue({
      items: [{ id: 'n1', name: 'Design notes' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-a-z';
    h.state.lists['tags-a-z'] = [TAG];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(select(0));

    expect(h.state.selectedNote).toEqual({
      noteId: 'n1',
      noteName: 'Design notes',
      returnTo: 'tag-notes',
    });
    expect(h.state.screen).toBe('note-actions');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
