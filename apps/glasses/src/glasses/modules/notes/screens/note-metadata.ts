import { getTextWidth, pxTruncate } from 'even-toolkit/pretext';
import { buildHeaderLine } from 'even-toolkit/text-utils';
import { CONTAINER_PADDING, SCREEN_W } from '../../../constants';
import type { ScreenModule } from '../../../types';

/** Inner width of the full-screen text container this screen renders into. */
const TEXT_INNER_W = SCREEN_W - 2 * CONTAINER_PADDING;
const PROJECT_PREFIX = 'Project: ';

/**
 * A note's metadata is just its Project — unlike task-details.ts, there's no
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
      // Unbounded server error — an overflowing line re-arms the firmware's
      // internal scroll (see constants.ts's reader-pagination comments).
      lines.push(pxTruncate(meta.error, TEXT_INNER_W));
    } else {
      const projectBudget = TEXT_INNER_W - getTextWidth(PROJECT_PREFIX);
      lines.push(`${PROJECT_PREFIX}${pxTruncate(meta.project ?? '(none)', projectBudget)}`);
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
