import { buildHeaderLine } from 'even-toolkit/text-utils';
import { READER_CHARS_PER_LINE } from '../constants';
import type { ScreenModule } from '../types';
import { truncateToByteLimit } from './shared';

/**
 * Budget for the title in the header. The header has to fit on one line — if
 * it wraps, the page runs a line over the container and re-arms the firmware
 * scroll that pagination exists to avoid. That leaves READER_CHARS_PER_LINE
 * minus the two spaces buildHeaderLine inserts and up to seven characters of
 * page indicator ("100/100").
 *
 * Measured in UTF-8 bytes rather than characters, which only ever truncates
 * earlier than the character budget would — the safe direction.
 */
const HEADER_TITLE_BYTES = READER_CHARS_PER_LINE - 2 - 7;

/**
 * The Notion page reader, shared by everything that can open a page: a task
 * through its action menu, a note by tapping it. Which of those led here is
 * carried in `state.pageContent` (its `title` and `returnTo`), so the screen
 * itself never has to know.
 *
 * `pages` arrives pre-split into screenfuls (see glasses/markdown-to-pages.ts), so
 * this only picks one and renders it — a tap or a downward swipe advances, an
 * upward swipe goes back, and a double-tap leaves.
 */
export const pageContentScreen: ScreenModule = {
  display(state) {
    const content = state.pageContent;
    const title = truncateToByteLimit(content?.title || 'PAGE', HEADER_TITLE_BYTES);

    if (!content || content.loading) {
      return {
        mode: 'text',
        content: [buildHeaderLine(title, state.spinnerFrame), '', 'Loading…'].join('\n'),
      };
    }

    if (content.error) {
      return {
        mode: 'text',
        content: [buildHeaderLine(title, ''), '', content.error, '', 'Double-tap to go back.'].join(
          '\n',
        ),
      };
    }

    if (content.pages.length === 0) {
      return {
        mode: 'text',
        content: [
          buildHeaderLine(title, ''),
          '',
          'This page is empty.',
          '',
          'Double-tap to go back.',
        ].join('\n'),
      };
    }

    const page = content.pages[content.index] ?? [];
    const indicator =
      content.pages.length > 1 ? `${content.index + 1}/${content.pages.length}` : '';
    return { mode: 'text', content: [buildHeaderLine(title, indicator), '', ...page].join('\n') };
  },

  action(action, state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner();
      ctx.navigate(state.pageContent?.returnTo ?? 'menu');
      return;
    }

    if (action.type === 'HIGHLIGHT_MOVE') {
      ctx.turnPage(action.direction === 'down' ? 1 : -1);
      return;
    }

    // SELECT_HIGHLIGHTED: a tap advances a page too. There's nothing to select
    // on a text screen, and click-to-advance is the gesture the G2's own
    // long-form text template uses — the swipe is easy to miss.
    ctx.turnPage(1);
  },
};
