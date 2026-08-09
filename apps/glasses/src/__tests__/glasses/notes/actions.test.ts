/**
 * Tapping a note on a list screen — opens the note action menu, and Note
 * Details fetches the note's project (notes have no due date).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageDetails } from '../../../api';
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
      items: ['Open page', 'Note Details', 'Change project', 'Delete note'],
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

describe('Note Details', () => {
  it('fetches the project and shows it with the note name, and no due date', async () => {
    vi.mocked(fetchPageDetails).mockResolvedValue({ project: 'Q3 Planning', due: null });
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));

    h.dispatch(select(1)); // Note Details
    await h.settle();

    expect(h.state.noteDetails).toEqual({ loading: false, project: 'Q3 Planning', error: '' });
    expect(h.state.screen).toBe('note-details');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('NOTE DETAILS');
      expect(display.content).toContain('Note:\nMeeting recap');
      expect(display.content).toContain('Project:\nQ3 Planning');
      expect(display.content).toContain('Double-tap to go back.');
      expect(display.content).not.toContain('Due:');
    }
  });

  it('keeps a long note name in the scrollable text container', async () => {
    const noteName = 'A note title that is intentionally long enough to overflow a row '.repeat(3);
    vi.mocked(fetchPageDetails).mockResolvedValue({ project: 'Q3 Planning', due: null });
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [{ id: 'n1', name: noteName }];
    h.dispatch(select(0));

    h.dispatch(select(1));
    await h.settle();

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain(noteName);
  });

  it('falls back to a placeholder title when no note is selected', () => {
    const h = mount();
    h.state.screen = 'note-details';
    h.state.noteDetails = { loading: false, project: null, error: '' };
    h.state.selectedNote = null;

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('Note:\n(unknown note)');
      expect(display.content).toContain('Project:\n(none)');
    }
  });

  it('shows the back hint while the details are still loading', () => {
    const h = mount();
    h.state.screen = 'note-details';
    h.state.noteDetails = { loading: true, project: null, error: '' };

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('Loading…');
      expect(display.content).toContain('Double-tap to go back.');
    }
  });

  it('shows the error message when the fetch fails', async () => {
    vi.mocked(fetchPageDetails).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));

    h.dispatch(select(1));
    await h.settle();

    expect(h.state.noteDetails).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from the details screen returns to the note action menu', () => {
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
