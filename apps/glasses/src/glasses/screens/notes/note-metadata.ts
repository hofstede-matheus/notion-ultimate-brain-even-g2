import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../types';

/**
 * A note's metadata is just its Project — unlike task-metadata.ts, there's no
 * Due date to show: Notes carry no Due property.
 */
export const noteMetadataScreen: ScreenModule = {
  display(state) {
    const header = buildHeaderLine('NOTE DETAILS', state.spinnerFrame);
    const meta = state.noteMetadata;

    const lines: string[] = [header, ''];
    if (!meta || meta.loading) {
      lines.push('Loading…');
    } else if (meta.error) {
      lines.push(meta.error);
    } else {
      lines.push(`Project: ${meta.project ?? '(none)'}`);
    }
    lines.push('', 'Double-tap to go back.');

    return { mode: 'text', content: lines.join('\n') };
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner();
      ctx.navigate('note-actions');
      return;
    }

    // SELECT_HIGHLIGHTED / HIGHLIGHT_MOVE: nothing to select on a text screen
  },
};
