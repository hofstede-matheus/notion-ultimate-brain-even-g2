import { fetchPageDetails } from '../../../api';
import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Note action menu — reached by tapping a note in any Notes list screen.
// Offers Open page / Note Details / Delete note. A note's details are its
// name and Project — Notes have no Due property, so note-details.ts (unlike
// task-details.ts) never shows one.
// ---------------------------------------------------------------------------

export function openNoteActions(noteId: string, noteName: string, returnTo: ScreenName): void {
  trace.info('NAV', `openNoteActions "${noteName}"`, { id: noteId });
  state.selectedNote = { noteId, noteName, returnTo };
  navigate('note-actions');
}

export async function enterNoteDetails(): Promise<void> {
  const selected = state.selectedNote;
  if (!selected) return;

  state.noteDetails = { loading: true, project: null, error: '' };
  navigate('note-details');

  const spinner = startSpinner(() => void renderUpdate('note-details'));

  try {
    const { project } = await fetchPageDetails(selected.noteId);
    trace.info('API', 'note details loaded', { id: selected.noteId, project });
    state.noteDetails = { loading: false, project, error: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('API', `note details failed: ${msg}`, { id: selected.noteId });
    state.noteDetails = {
      loading: false,
      project: null,
      error: msg,
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'note-details') void renderFull();
  }
}
