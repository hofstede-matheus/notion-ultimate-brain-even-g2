/**
 * Tapping a note on a list screen opens its Note Details, which fetches the
 * note's project (notes have no due date). Details is where the OS contextual
 * menu lives — a list-anchored menu cannot tell which row is highlighted (see
 * glasses/context-menu.ts). Unlike a task, a note has no hold shortcut: it is
 * never "done".
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageDetails } from '../../../api';
import { NOTE_CONTEXT_MENU } from '../../../glasses/context-menu';
import { back, longPress, menuItemId, mount, select } from '../harness';

const NOTE = { id: 'n1', name: 'Meeting recap' };

function menuId(label: string): number {
  return menuItemId(NOTE_CONTEXT_MENU, label);
}

describe('tapping a note on a list screen', () => {
  it('opens Note Details, with the note stashed for the contextual menu', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.selectedNote).toEqual({
      noteId: 'n1',
      noteName: 'Meeting recap',
      returnTo: 'notes-inbox',
    });
    expect(h.state.screen).toBe('note-details');
    expect(h.state.pageContent).toBeNull();
  });

  it('GO_BACK from details returns to the list the note was opened from', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.screen).toBe('notes-inbox');
  });
});

describe('a note list declares no contextual menu', () => {
  it('renders no menu on the list itself', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];

    expect(h.render().menu).toBeUndefined();
  });

  it('a hold on a list row does nothing at all', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];

    h.dispatch(longPress(0));

    expect(h.state.screen).toBe('notes-inbox');
    expect(h.state.selectedNote).toBeNull();
  });
});

describe('the Note Details contextual menu', () => {
  it('declares the three note actions — no Mark as done, no Change due date', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
    await h.settle();

    const display = h.render();
    expect(display.menu?.map((i) => i.label)).toEqual([
      'Open page',
      'Change project',
      'Delete note',
    ]);
  });

  it('holding does nothing — a note is never done', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(longPress());

    expect(h.state.screen).toBe('note-details');
    expect(h.state.pendingAction).toBeNull();
  });

  it('"Open page" opens the reader, returning to details', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
    await h.settle();

    h.menuClick(menuId('Open page'));
    await h.settle();

    expect(h.state.screen).toBe('page-content');
    expect(h.state.pageContent).toMatchObject({
      title: 'Meeting recap',
      returnTo: 'note-details',
    });
  });
});

describe('Note Details', () => {
  it('fetches the project and shows it with the note name, and no due date', async () => {
    vi.mocked(fetchPageDetails).mockResolvedValue({ project: 'Q3 Planning', due: null });
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0));
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
    await h.settle();

    expect(h.state.noteDetails).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from the details screen returns to the list the note came from', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [NOTE];
    h.dispatch(select(0)); // still loading — fine for this assertion

    h.dispatch(back());

    expect(h.state.screen).toBe('notes-inbox');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
