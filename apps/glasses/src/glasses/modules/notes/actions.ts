import { fetchPageMetadata } from '../../../api';
import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Note action menu — reached by tapping a note in any Notes list screen.
// Offers Open page / Load metadata / Delete note. A note's metadata is just
// its Project — Notes have no Due property, so note-metadata.ts (unlike
// task-metadata.ts) never asks for one.
// ---------------------------------------------------------------------------

export function openNoteActions(noteId: string, noteName: string, returnTo: ScreenName): void {
  trace.info('NAV', `openNoteActions "${noteName}"`, { id: noteId });
  state.selectedNote = { noteId, noteName, returnTo };
  navigate('note-actions');
}

export async function enterNoteMetadata(): Promise<void> {
  const selected = state.selectedNote;
  if (!selected) return;

  state.noteMetadata = { loading: true, project: null, error: '' };
  navigate('note-metadata');

  const spinner = startSpinner(() => void renderUpdate('note-metadata'));

  try {
    const { project } = await fetchPageMetadata(selected.noteId);
    trace.info('API', 'note metadata loaded', { id: selected.noteId, project });
    state.noteMetadata = { loading: false, project, error: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('API', `note metadata failed: ${msg}`, { id: selected.noteId });
    state.noteMetadata = {
      loading: false,
      project: null,
      error: msg,
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'note-metadata') void renderFull();
  }
}
