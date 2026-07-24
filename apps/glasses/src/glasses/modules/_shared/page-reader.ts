import { trace } from '../../../logging/trace';
import { loadPageContent } from '../../../page-loader';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { markdownToPages } from '../../content/markdown-to-pages';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from './navigation';

// ---------------------------------------------------------------------------
// Page reader — reads any Notion page (see ../../page-loader.ts) and parses
// its markdown into screenfuls of text up front, since the firmware can't be
// handed a whole document at once (see ../content/markdown-to-pages.ts).
// Reached from a task's action menu and a note's action menu.
// ---------------------------------------------------------------------------

/** Shown as the reader's final page when Notion's own export cut the body short. */
const TRUNCATED_NOTICE = ['Page truncated by Notion.'];

/**
 * Invalidates a read the user has moved on from. A big page's markdown fetch
 * can still take a moment, so backing out and opening something else easily
 * leaves the first one in flight — and every reader shares the one
 * 'page-content' screen, so without this the abandoned read's result would
 * land on top of whatever the user is actually looking at.
 */
let pageSession = 0;

export async function openPage(pageId: string, title: string, returnTo: ScreenName): Promise<void> {
  const mySession = ++pageSession;
  const base = { title, returnTo, pages: [] as string[][], index: 0, error: '' };

  trace.info('NAV', `openPage "${title}"`, { id: pageId });
  state.pageContent = { ...base, loading: true };
  navigate('page-content');

  const spinner = startSpinner(() => void renderUpdate('page-content'));

  try {
    const { markdown, truncated } = await loadPageContent(pageId);
    if (mySession !== pageSession) {
      trace.debug('NAV', `openPage "${title}" resolved after session moved on — discarded`);
      return;
    }
    const pages = markdownToPages(markdown);
    if (truncated) pages.push(TRUNCATED_NOTICE);
    trace.info('NAV', `openPage "${title}" loaded`, {
      markdownLen: markdown.length,
      pages: pages.length,
      truncated,
    });
    state.pageContent = { ...base, loading: false, pages };
  } catch (e) {
    if (mySession !== pageSession) return;
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('NAV', `openPage "${title}" failed: ${msg}`, { id: pageId });
    state.pageContent = {
      ...base,
      loading: false,
      error: msg,
    };
  } finally {
    // Still runs for the early returns above, hence the second check: a stale
    // read must not stop the live one's spinner or repaint its screen.
    if (mySession === pageSession) {
      stopSpinner(spinner);
      if (state.screen === 'page-content') void renderFull();
    }
  }
}

export function turnPage(delta: number): void {
  const content = state.pageContent;
  if (!content || content.loading || content.error) return;

  const next = content.index + delta;
  if (next < 0 || next >= content.pages.length) return;

  trace.debug('NAV', `page reader ${next + 1}/${content.pages.length}`);
  content.index = next;
  // The layout is identical page to page, so an in-place content upgrade is
  // enough — and avoids the full-rebuild flicker on every page turn.
  void renderUpdate('page-content');
}
