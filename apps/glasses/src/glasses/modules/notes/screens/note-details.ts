import { NOTE_CONTEXT_MENU } from '../../../context-menu';
import { makeDetailsScreen } from '../../_shared/details-screen';

/**
 * A note's details: its name in full, and the project it is filed under —
 * unlike task-details.ts there's no Due line, since Notes carry no Due
 * property.
 *
 * What a tap on a note row opens; reading the page is a menu item away.
 * No `onHold` here, unlike task-details: a note is never "done", so a hold
 * has nothing to shortcut to.
 */
export const noteDetailsScreen = makeDetailsScreen({
  title: 'NOTE DETAILS',
  parent: (state) => state.selectedNote?.returnTo ?? 'notes-menu',
  menu: NOTE_CONTEXT_MENU,
  read(state) {
    const details = state.noteDetails;
    if (!details) return null;
    return {
      loading: details.loading,
      error: details.error,
      fields: [
        { label: 'Note:', value: state.selectedNote?.noteName ?? '(unknown note)' },
        { label: 'Project:', value: details.project ?? '(none)' },
      ],
    };
  },
});
