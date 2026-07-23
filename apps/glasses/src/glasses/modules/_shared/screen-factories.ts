import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState, ListItem, ScreenName } from '../../../state';
import { MAX_ITEM_BYTES, MAX_LIST_ITEMS } from '../../constants';
import type { GlassCtx, MenuDef, ScreenModule } from '../../types';

export { MAX_LIST_ITEMS } from '../../constants';

const byteEncoder = new TextEncoder();

/** Truncates `text` to fit within `maxBytes` UTF-8 bytes, appending an ellipsis if cut. */
export function truncateToByteLimit(text: string, maxBytes: number = MAX_ITEM_BYTES): string {
  if (byteEncoder.encode(text).length <= maxBytes) return text;

  const ellipsis = '…';
  const budget = maxBytes - byteEncoder.encode(ellipsis).length;
  let result = '';
  let bytes = 0;
  for (const ch of text) {
    const chBytes = byteEncoder.encode(ch).length;
    if (bytes + chBytes > budget) break;
    result += ch;
    bytes += chBytes;
  }
  return result + ellipsis;
}

/**
 * Truncates `text` so that `prefix + result` together fit within `maxBytes`
 * UTF-8 bytes — for building list items like "Confirm: <name>" without the
 * prefix pushing the combined string over the native-list cap.
 */
export function truncatePrefixedToByteLimit(
  prefix: string,
  text: string,
  maxBytes: number = MAX_ITEM_BYTES,
): string {
  const prefixBytes = byteEncoder.encode(prefix).length;
  const budget = Math.max(0, maxBytes - prefixBytes);
  return prefix + truncateToByteLimit(text, budget);
}

/**
 * Generic factory for any list-style menu screen — header + native list
 * widget, click dispatches to `item.target` (no-op when undefined). Pass
 * `clickRouter` to override the default `ctx.navigate(target)` for screens
 * whose targets need bespoke entry points (e.g. resetting a selected-index
 * before navigating).
 */
export function makeMenuScreen(
  def: MenuDef,
  clickRouter?: (target: ScreenName, ctx: GlassCtx) => void,
): ScreenModule {
  const route = clickRouter ?? ((target, ctx) => ctx.navigate(target));
  return {
    display(_state) {
      return {
        mode: 'list',
        header: buildHeaderLine(def.title, ''),
        items: def.items.map((i) => i.label),
      };
    },

    action(action, _state, ctx) {
      if (action.type === 'GO_BACK') {
        if (def.parent) ctx.navigate(def.parent);
        else ctx.shutdown();
        return;
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        const idx = action.itemIndex;
        if (typeof idx === 'number') {
          const item = def.items[idx];
          if (item?.target) route(item.target, ctx);
        }
        return;
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    },
  };
}

/**
 * Placeholder screen for menu items not yet implemented. Renders a simple
 * "Coming soon" message; GO_BACK returns to `parent` (the owning group's
 * submenu). Not wired into the router until its item gets a real `target`.
 */
export function makeStubScreen(label: string, parent: ScreenName): ScreenModule {
  return {
    display() {
      return {
        mode: 'text',
        content: [label.toUpperCase(), '', 'Coming soon.', '', 'Double-tap to go back.'].join('\n'),
      };
    },

    action(action, _state, ctx) {
      if (action.type === 'GO_BACK') ctx.navigate(parent);
    },
  };
}

/** Returns the flat list of items cached for a generic list-view screen. */
export function getListItems(state: AppState, screen: ScreenName): ListItem[] {
  return state.lists[screen] ?? [];
}

/** Label for the tappable row that steps back a page. */
export const PREV_PAGE_LABEL = '◂ Prev';
/** Label for the tappable row that steps forward a page. */
export const NEXT_PAGE_LABEL = '▸ More';

/**
 * Real items per page once a list needs paging at all — two of the native
 * widget's 20 rows are reserved for the Prev/More affordance rows below.
 * Lists that fit in a single page (the common case) use the full
 * MAX_LIST_ITEMS with no reserved rows — see the items.length check below.
 */
const PAGED_PAGE_SIZE = MAX_LIST_ITEMS - 2;

interface PageSlice<T> {
  pageItems: T[];
  start: number;
  totalPages: number;
  clampedPage: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Slices a fully-fetched list into a page the native list widget can render
 * (it has a hard 20-item cap — see constants.ts). `pageIndex` is clamped in
 * case the list shrank (e.g. an item was deleted) out from under a page the
 * user had paged into.
 *
 * Turning a page needs an explicit, guaranteed-reliable gesture — a native
 * list's SCROLL_TOP/BOTTOM boundary events turned out not to fire
 * consistently in practice for a maxed-out (itemCount 20) list, so rather
 * than depend on that, a page with more to show reserves a row for a
 * tappable Prev/More control (SELECT_HIGHLIGHTED, the same proven mechanism
 * every other row in the app already uses).
 */
function paginateItems<T>(items: T[], pageIndex: number): PageSlice<T> {
  if (items.length <= MAX_LIST_ITEMS) {
    return {
      pageItems: items,
      start: 0,
      totalPages: 1,
      clampedPage: 0,
      hasPrev: false,
      hasNext: false,
    };
  }
  const totalPages = Math.ceil(items.length / PAGED_PAGE_SIZE);
  const clampedPage = Math.min(Math.max(pageIndex, 0), totalPages - 1);
  const start = clampedPage * PAGED_PAGE_SIZE;
  return {
    pageItems: items.slice(start, start + PAGED_PAGE_SIZE),
    start,
    totalPages,
    clampedPage,
    hasPrev: clampedPage > 0,
    hasNext: clampedPage < totalPages - 1,
  };
}

/** What tapping a row on a list screen does. */
type SelectKind = 'task' | 'project' | 'note';

/**
 * Screens whose list items are Project records. Used to route
 * SELECT_HIGHLIGHTED to openProjectDetail() — can't duck-type this off an
 * item field since Task now also carries an optional `status` (for the
 * project-tasks `[ ]`/`[v]` prefix), so a due-date-less Task and a Project
 * would otherwise be indistinguishable by shape alone.
 */
const PROJECT_LIST_SCREENS: ScreenName[] = [
  'projects-doing',
  'projects-ongoing',
  'projects-planned',
  'projects-on-hold',
  'projects-done',
  'projects-board',
  'projects-archived',
];

/**
 * Screens whose list items are Note records — tapping one opens the page
 * reader. Listed explicitly for the same reason as PROJECT_LIST_SCREENS: a
 * Note carries nothing a Tag doesn't, so shape alone can't tell them apart.
 *
 * Every notes list screen must appear here or its rows go dead; a test in
 * menu.test.ts checks this against the router's registered screens.
 */
const NOTE_LIST_SCREENS: ScreenName[] = [
  'notes-inbox',
  'notes-favorites',
  'notes-by-tag',
  'notes-list',
  'notes-meetings',
  'notes-by-project',
  'notes-clips',
  'notes-voice',
  'notes-journal',
  'notes-all',
  'project-notes',
];

/**
 * What a tap on `screen` should open, when the screen's config doesn't say
 * outright. Keyed on the screen rather than the item's shape: the records are
 * too alike to tell apart by hand — a Task and a Project both carry `status`,
 * a Note carries nothing a Tag doesn't — and the fields that would distinguish
 * them are optional, so JSON drops them when they're unset. Tapping an undated
 * task used to do nothing at all for exactly that reason.
 *
 * Screens absent from both lists (the Tags views) have no detail view yet, so
 * their rows are deliberately inert.
 */
function selectKindFor(screen: ScreenName): SelectKind | undefined {
  if (PROJECT_LIST_SCREENS.includes(screen)) return 'project';
  if (NOTE_LIST_SCREENS.includes(screen)) return 'note';
  return undefined;
}

export interface ListScreenConfig {
  /** This screen's own name — used to key state.lists (unless `selectItems` is given). */
  screen: ScreenName;
  /** Screen to return to on GO_BACK (the owning domain's submenu). */
  parent: ScreenName;
  /** Header title, e.g. "NEXT 7 DAYS". Can depend on state (e.g. the selected project's name). */
  title: string | ((state: AppState) => string);
  /** Shown (alongside "Double-tap to go back.") when the list is empty. */
  emptyMessage?: string;
  /** Shown while state.loading. Defaults to 'Fetching…'. */
  loadingMessage?: string;
  /** Whether the list-mode header appends "(count)". Defaults to true. */
  countInHeader?: boolean;
  /** Formats a single item's label. Defaults to `item.name`. */
  formatLabel?: (item: ListItem) => string;
  /**
   * Overrides the item source for both display and selection — used by
   * Today/Overdue, which are filtered views over the array fetched under a
   * different screen key (see _shared/navigation.ts's DATA_KEY_OVERRIDES). Defaults to
   * `state.lists[config.screen]`.
   */
  selectItems?: (state: AppState) => ListItem[];
  /**
   * Explicit item kind for SELECT_HIGHLIGHTED dispatch, bypassing
   * selectKindFor's heuristics — used by Today/Overdue/Inbox, whose items are
   * always Tasks by construction.
   */
  onSelect?: SelectKind;
}

/**
 * Generic factory for a fetched-list screen (every Tasks/Notes/Projects/Tags
 * view, including Today/Overdue/Inbox). Renders a loading placeholder while
 * state.loading, an empty-state message when the list is empty, otherwise a
 * header + native list of item names, paged MAX_LIST_ITEMS at a time (the
 * fetched list itself is complete — see _shared/pagination.ts's
 * fetchAllPages — the cap here is only the native widget's own display
 * limit). Reads from `config.selectItems(state)` if given, else
 * `state.lists[config.screen]` — both populated by ctx.enterView() in
 * _shared/navigation.ts.
 *
 * A page beyond the first shows a tappable "◂ Prev"/"▸ More" row (see
 * paginateItems) to turn the page — swiping past the current page's
 * top/bottom row (HIGHLIGHT_MOVE) does the same thing when the firmware
 * happens to deliver that gesture, but isn't relied on as the only way in.
 */
export function makeListScreen(config: ListScreenConfig): ScreenModule {
  const emptyMessage = config.emptyMessage ?? 'No items.';
  const loadingMessage = config.loadingMessage ?? 'Fetching…';
  const countInHeader = config.countInHeader ?? true;
  const formatLabel = config.formatLabel ?? ((item: ListItem) => item.name);
  const selectItems =
    config.selectItems ?? ((state: AppState) => getListItems(state, config.screen));

  return {
    display(state) {
      const title = typeof config.title === 'function' ? config.title(state) : config.title;

      if (state.loading) {
        return {
          mode: 'text',
          content: [buildHeaderLine(title, state.spinnerFrame), '', loadingMessage].join('\n'),
        };
      }

      const items = selectItems(state);
      if (items.length === 0) {
        return {
          mode: 'text',
          content: [
            buildHeaderLine(title, state.spinnerFrame),
            '',
            emptyMessage,
            '',
            'Double-tap to go back.',
          ].join('\n'),
        };
      }

      const { pageItems, totalPages, clampedPage, hasPrev, hasNext } = paginateItems(
        items,
        state.listPages[config.screen] ?? 0,
      );
      const headerTitle = countInHeader ? `${title} (${items.length})` : title;
      // The spinner (background refresh) and the page indicator share the
      // header's second slot — a live spinner tick always takes priority,
      // matching the page reader's own header layout.
      const indicator =
        state.spinnerFrame || (totalPages > 1 ? `${clampedPage + 1}/${totalPages}` : '');
      const header = buildHeaderLine(headerTitle, indicator);
      const listItems: string[] = [];
      if (hasPrev) listItems.push(PREV_PAGE_LABEL);
      listItems.push(...pageItems.map((i) => truncateToByteLimit(formatLabel(i))));
      if (hasNext) listItems.push(NEXT_PAGE_LABEL);
      return { mode: 'list', header, items: listItems };
    },

    action(action, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner();
        ctx.navigate(config.parent);
        return;
      }

      const items = selectItems(state);
      const { start, totalPages, hasPrev, hasNext, pageItems } = paginateItems(
        items,
        state.listPages[config.screen] ?? 0,
      );

      if (action.type === 'SELECT_HIGHLIGHTED') {
        if (typeof action.itemIndex === 'number') {
          let idx = action.itemIndex;
          if (hasPrev) {
            if (idx === 0) {
              ctx.turnListPage(config.screen, -1, totalPages);
              return;
            }
            idx -= 1;
          }
          if (hasNext && idx === pageItems.length) {
            ctx.turnListPage(config.screen, 1, totalPages);
            return;
          }
          const item = items[start + idx];
          if (item) {
            const kind = config.onSelect ?? selectKindFor(config.screen);
            if (kind === 'task') ctx.openTaskActions(item.id, item.name, config.screen);
            else if (kind === 'project') ctx.openProjectDetail(item.id, item.name, config.screen);
            else if (kind === 'note') ctx.openNoteActions(item.id, item.name, config.screen);
          }
        }
        return;
      }

      // HIGHLIGHT_MOVE: swiping past the current page's top/bottom row turns
      // the page when the firmware delivers the gesture. A no-op when
      // there's only one page (the common case).
      ctx.turnListPage(config.screen, action.direction === 'down' ? 1 : -1, totalPages);
    },
  };
}
