import { getTextWidth, pxTruncate } from 'even-toolkit/pretext';
import { buildHeaderLine } from 'even-toolkit/text-utils';
import { CONTAINER_PADDING, SCREEN_W } from '../../../constants';
import { markdownToLines, paginateLines } from '../../../content/markdown-to-pages';
import type { ScreenModule } from '../../../types';
import { formatDueDate } from '../helpers';

/** Inner width of the full-screen text container this screen renders into. */
const TEXT_INNER_W = SCREEN_W - 2 * CONTAINER_PADDING;
const PROJECT_PREFIX = 'Project: ';
const DETAILS_LINES_PER_PAGE = 8;

function detailPages(taskName: string, project: string | null, due: string | null): string[][] {
  const projectBudget = TEXT_INNER_W - getTextWidth(PROJECT_PREFIX);
  return paginateLines(
    [
      'Task:',
      ...markdownToLines(taskName),
      '',
      `${PROJECT_PREFIX}${pxTruncate(project ?? '(none)', projectBudget)}`,
      `Due: ${formatDueDate(due)}`,
    ],
    DETAILS_LINES_PER_PAGE,
  );
}

export const taskMetadataScreen: ScreenModule = {
  display(state) {
    const meta = state.taskMetadata;

    if (!meta || meta.loading) {
      return {
        mode: 'text',
        content: [buildHeaderLine('TASK DETAILS', state.spinnerFrame), '', 'Loading…'].join('\n'),
      };
    }

    if (meta.error) {
      // Unbounded server error — an overflowing line re-arms the firmware's
      // internal scroll (see constants.ts's reader-pagination comments).
      return {
        mode: 'text',
        content: [
          buildHeaderLine('TASK DETAILS', ''),
          '',
          pxTruncate(meta.error, TEXT_INNER_W),
          '',
          'Double-tap to go back.',
        ].join('\n'),
      };
    }

    const pages = detailPages(
      state.selectedTask?.taskName ?? '(unknown task)',
      meta.project,
      meta.due,
    );
    const pageIndex = Math.min(meta.page, pages.length - 1);
    const indicator = pages.length > 1 ? `${pageIndex + 1}/${pages.length}` : '';
    return {
      mode: 'text',
      content: [buildHeaderLine('TASK DETAILS', indicator), '', ...(pages[pageIndex] ?? [])].join(
        '\n',
      ),
    };
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner();
      ctx.navigate('task-actions');
      return;
    }

    const meta = _state.taskMetadata;
    if (!meta || meta.loading || meta.error) return;

    const pages = detailPages(
      _state.selectedTask?.taskName ?? '(unknown task)',
      meta.project,
      meta.due,
    );
    if (action.type === 'HIGHLIGHT_MOVE') {
      ctx.turnTaskMetadataPage(action.direction === 'down' ? 1 : -1, pages.length);
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') ctx.turnTaskMetadataPage(1, pages.length);
  },
};
