/**
 * Tapping a note on a list screen — opens the note action menu, and Load
 * metadata fetches the note's project (notes have no due date).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageMetadata } from '../../../api';
import { back, mount, select } from '../harness';

const NOTE = { id: 'n1', name: 'Meeting recap' };

describe('tapping a note on a list screen', () => {
  it('opens the note action menu with the tapped note selected', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];

    h.dispatch(select(0));

    expect(h.state.selectedNote).toEqual({
      noteId: 'n1',
      noteName: 'Meeting recap',
      returnTo: 'notes-inbox',
    });
    expect(h.state.screen).toBe('note-actions');
    expect(h.render()).toMatchObject({
      mode: 'list',
      items: ['Open page', 'Load metadata', 'Delete note'],
    });
  });

  it('GO_BACK returns to the list the note was opened from', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));

    h.dispatch(back());

    expect(h.state.screen).toBe('notes-inbox');
  });
});

describe('Load metadata', () => {
  it('fetches the project and shows it, with no due date', async () => {
    vi.mocked(fetchPageMetadata).mockResolvedValue({ project: 'Q3 Planning', due: null });
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));

    h.dispatch(select(1)); // Load metadata
    await h.settle();

    expect(h.state.noteMetadata).toEqual({ loading: false, project: 'Q3 Planning', error: '' });
    expect(h.state.screen).toBe('note-metadata');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('Project: Q3 Planning');
      expect(display.content).not.toContain('Due:');
    }
  });

  it('shows the error message when the fetch fails', async () => {
    vi.mocked(fetchPageMetadata).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));

    h.dispatch(select(1));
    await h.settle();

    expect(h.state.noteMetadata).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from metadata returns to the note action menu', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
    h.dispatch(select(1));

    h.dispatch(back());

    expect(h.state.screen).toBe('note-actions');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
