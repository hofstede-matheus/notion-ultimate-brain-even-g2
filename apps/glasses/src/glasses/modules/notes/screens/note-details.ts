import { makeDetailsScreen } from '../../_shared/details-screen';

/**
 * A note's details: its name in full, and the project it is filed under —
 * unlike task-details.ts there's no Due line, since Notes carry no Due
 * property.
 */
export const noteDetailsScreen = makeDetailsScreen({
  title: 'NOTE DETAILS',
  parent: (state) => state.selectedNote?.returnTo ?? 'notes-menu',
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
