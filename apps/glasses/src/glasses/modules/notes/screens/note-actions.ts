import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState } from '../../../../state';
import { MAX_ITEM_BYTES } from '../../../constants';
import type { GlassCtx, ScreenModule } from '../../../types';
import { truncateToByteLimit } from '../../_shared/screen-factories';

type SelectedNote = NonNullable<AppState['selectedNote']>;

/**
 * The menu shown after tapping a note. A note has no "done" state, so unlike
 * the task menu this has no mark-as-done entry — just read, inspect, remove.
 */
const ACTIONS: Array<{ label: string; run: (note: SelectedNote, ctx: GlassCtx) => void }> = [
  {
    label: 'Open page',
    run: (note, ctx) => ctx.openPage(note.noteId, note.noteName, 'note-actions'),
  },
  { label: 'Load metadata', run: (_note, ctx) => ctx.enterNoteMetadata() },
  {
    label: 'Delete note',
    run: (note, ctx) => ctx.openConfirm('delete', note.noteId, note.noteName, note.returnTo),
  },
];

export const noteActionsScreen: ScreenModule = {
  display(state) {
    const selected = state.selectedNote;
    const name = selected ? truncateToByteLimit(selected.noteName, MAX_ITEM_BYTES) : '';
    return {
      mode: 'list',
      header: buildHeaderLine(name, ''),
      items: ACTIONS.map((action) => action.label),
    };
  },

  action(action, state, ctx) {
    const selected = state.selectedNote;

    if (action.type === 'GO_BACK') {
      ctx.navigate(selected?.returnTo ?? 'notes-menu');
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (typeof action.itemIndex === 'number' && selected) {
        ACTIONS[action.itemIndex]?.run(selected, ctx);
      }
      return;
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
};
