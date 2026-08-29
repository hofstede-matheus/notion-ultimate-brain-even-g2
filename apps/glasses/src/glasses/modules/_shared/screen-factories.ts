import { getTextWidth, pxTruncate } from 'even-toolkit/pretext';
import { buildHeaderLine } from 'even-toolkit/text-utils';
import { trace } from '../../../logging/trace';
import type { AppState, ListItem, ScreenName } from '../../../state';
import { LIST_ITEM_PADDING_X, MAX_ITEM_BYTES, MAX_LIST_ITEMS, SCREEN_W } from '../../constants';
import { NOTE_CONTEXT_MENU, TASK_CONTEXT_MENU } from '../../context-menu';
import type { ContextMenuItem, GlassCtx, MenuDef, ScreenModule } from '../../types';

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

/** Inner width of a native list row: full screen width minus the widget's own horizontal padding. */
const LIST_ITEM_INNER_W = SCREEN_W - 2 * LIST_ITEM_PADDING_X;

/**
 * Truncates `text` to what the native list widget actually clips (pixel
 * width, via `even-toolkit/pretext`'s LVGL-accurate `pxTruncate`), then
 * applies `truncateToByteLimit` as a backstop — the firmware's 63-byte cap
 * rejects the whole rebuild if crossed, and byte length isn't derivable
 * from a pixel-fit string alone. Pixel truncation runs first because it's
 * closer to what actually overflows: bytes over-truncate accented names and
 * under-truncate wide ASCII relative to the 552px a row actually has.
 */
export function truncateListLabel(text: string): string {
  return truncateToByteLimit(pxTruncate(text, LIST_ITEM_INNER_W));
}

/**
 * Truncates `text` so `prefix + result` fits a list row — the pixel
 * counterpart to `truncatePrefixedToByteLimit`, for items like
 * "Confirm: <name>" or "To <project>".
 */
export function truncatePrefixedListLabel(prefix: string, text: string): string {
  const budgetPx = Math.max(0, LIST_ITEM_INNER_W - getTextWidth(prefix));
  return truncateToByteLimit(prefix + pxTruncate(text, budgetPx));
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
        // Every menu today is static and well within both caps, but one
        // oversized/localized label would otherwise reject the whole
        // rebuild — see makeListScreen's identical guards below.
        items: def.items.slice(0, MAX_LIST_ITEMS).map((i) => truncateListLabel(i.label)),
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
          if (item?.target) {
            trace.info('SEL', `menu "${item.label}" (idx ${idx}) -> ${item.target}`);
            route(item.target, ctx);
          } else if (item) {
            trace.warn('SEL', `menu item "${item.label}" has no target`);
          }
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
type SelectKind = 'task' | 'project' | 'note' | 'tag' | 'project-pick';

/**
 * Screens whose list items are Project records. Used to route
 * SELECT_HIGHLIGHTED to openProjectDetail() — can't duck-type this off an
 * item field since Task now also carries an optional `status` (for the
 * project-tasks `[ ]`/`[v]` prefix), so a due-date-less Task and a Project
 * would otherwise be indistinguishable by shape alone.
 */
const PROJECT_LIST_SCREENS: ScreenName[] = [
  'projects-all',
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
 * Screens whose list items are Tag records — tapping one opens that tag's
 * notes (openTagNotes). Listed explicitly for the same shape-ambiguity
 * reason as PROJECT_LIST_SCREENS/NOTE_LIST_SCREENS.
 */
const TAG_LIST_SCREENS: ScreenName[] = [
  'tags-recent',
  'tags-favorites',
  'tags-a-z',
  'tags-types-area',
  'tags-types-resource',
  'tags-types-entity',
];

/**
 * What a tap on `screen` should open, when the screen's config doesn't say
 * outright. Keyed on the screen rather than the item's shape: the records are
 * too alike to tell apart by hand — a Task and a Project both carry `status`,
 * a Note carries nothing a Tag doesn't — and the fields that would distinguish
 * them are optional, so JSON drops them when they're unset. Tapping an undated
 * task used to do nothing at all for exactly that reason.
 */
function selectKindFor(screen: ScreenName): SelectKind | undefined {
  if (PROJECT_LIST_SCREENS.includes(screen)) return 'project';
  if (NOTE_LIST_SCREENS.includes(screen)) return 'note';
  if (TAG_LIST_SCREENS.includes(screen)) return 'tag';
  return undefined;
}

/** Cold-failure text (no cache, refresh failed) — distinct from `emptyMessage` so a genuinely
 *  empty view can never be mistaken for an unreachable one. See navigation.ts's enterView. */
const LOAD_FAILED_MESSAGE = "Couldn't load. Check your phone, then try again.";
/** Same case, but the failure looked config-shaped (see config-health.ts's reportApiFailure) —
 *  points at Settings instead of a generic retry. */
const CONFIG_SUSPECT_MESSAGE = 'Setup needs attention. Continue on your phone.';
/** Warm-stale header indicator — a refresh failed but these are still last session's items. */
const STALE_INDICATOR = 'old';

export interface ListScreenConfig {
  /** This screen's own name — used to key state.lists (unless `selectItems` is given). */
  screen: ScreenName;
  /**
   * Screen to return to on GO_BACK (the owning domain's submenu). Can depend
   * on state (e.g. tag-notes returns to whichever tags list screen the tap
   * came from, stashed on state.selectedTag.returnTo).
   */
  parent: ScreenName | ((state: AppState) => ScreenName);
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
  onSelect?: SelectKind | ((state: AppState) => SelectKind);
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
    config.selectItems ??
    ((state: AppState) => {
      const items = getListItems(state, config.screen);
      return state.projectPicker && PROJECT_LIST_SCREENS.includes(config.screen)
        ? [...items].sort((a, b) => a.name.localeCompare(b.name))
        : items;
    });

  /** Same resolution `display()` and `action()` both need — kept in one place so the menu a
   * screen declares can never drift from what SELECT_HIGHLIGHTED/LONG_PRESS route to. */
  function resolveKind(state: AppState): SelectKind | undefined {
    const configuredKind =
      typeof config.onSelect === 'function' ? config.onSelect(state) : config.onSelect;
    return configuredKind ?? selectKindFor(config.screen);
  }

  /** The OS contextual menu for this screen's rows, or undefined for screens whose rows have
   * no item actions (projects, tags, the project picker). */
  function menuFor(state: AppState): ContextMenuItem[] | undefined {
    const kind = resolveKind(state);
    if (kind === 'task') return TASK_CONTEXT_MENU;
    if (kind === 'note') return NOTE_CONTEXT_MENU;
    return undefined;
  }

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
        // A refresh failure with no cache to fall back on looks exactly like a genuinely
        // empty list unless flagged — see navigation.ts's enterView catch, which is the only
        // writer of listStatus.
        const failed = state.listStatus[config.screen] === 'failed';
        const message = failed
          ? state.configSuspect
            ? CONFIG_SUSPECT_MESSAGE
            : LOAD_FAILED_MESSAGE
          : emptyMessage;
        return {
          mode: 'text',
          content: [
            buildHeaderLine(title, state.spinnerFrame),
            '',
            message,
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
      // The spinner (background refresh) and the page indicator share the header's second
      // slot — a live spinner tick always takes priority, matching the page reader's own
      // header layout. A 'stale' listStatus (cached items on screen, last refresh failed —
      // see navigation.ts's enterView) composes with the page indicator rather than
      // replacing it, so "old 1/3" stays legible on a paged list.
      const stale = state.listStatus[config.screen] === 'stale';
      const pageIndicator = totalPages > 1 ? `${clampedPage + 1}/${totalPages}` : '';
      const indicator =
        state.spinnerFrame ||
        [stale ? STALE_INDICATOR : '', pageIndicator].filter(Boolean).join(' ');
      const header = buildHeaderLine(headerTitle, indicator);
      const listItems: string[] = [];
      if (hasPrev) listItems.push(PREV_PAGE_LABEL);
      listItems.push(...pageItems.map((i) => truncateListLabel(formatLabel(i))));
      if (hasNext) listItems.push(NEXT_PAGE_LABEL);
      return { mode: 'list', header, items: listItems, menu: menuFor(state) };
    },

    action(action, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner();
        const parent = typeof config.parent === 'function' ? config.parent(state) : config.parent;
        trace.info('NAV', `back ${config.screen} -> ${parent}`);
        ctx.navigate(parent);
        return;
      }

      const items = selectItems(state);
      const { start, totalPages, hasPrev, hasNext, pageItems } = paginateItems(
        items,
        state.listPages[config.screen] ?? 0,
      );

      // Resolves a raw itemIndex (from either SELECT_HIGHLIGHTED or LONG_PRESS) through the
      // same Prev/More offset paginateItems reserves rows for — a row on a later page would
      // otherwise resolve to the wrong underlying item. Returns undefined for a Prev/More row
      // itself (the caller already turned the page) or an out-of-range index.
      function resolveItem(itemIndex: number): ListItem | undefined {
        let idx = itemIndex;
        if (hasPrev) {
          if (idx === 0) return undefined;
          idx -= 1;
        }
        if (hasNext && idx === pageItems.length) return undefined;
        return items[start + idx];
      }

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
            // Remembered as the LONG_PRESS fallback below — see
            // state.lastHighlightedIndex's doc comment for why this exists.
            state.lastHighlightedIndex[config.screen] = action.itemIndex;
            const kind = resolveKind(state);
            trace.info('SEL', `${config.screen} row ${idx} "${item.name}"`, {
              id: item.id,
              kind: kind ?? 'unknown',
            });
            if (kind === 'task') {
              ctx.selectTask(
                item.id,
                item.name,
                config.screen,
                'dueDate' in item ? item.dueDate : undefined,
              );
              ctx.openPage(item.id, item.name, config.screen);
            } else if (kind === 'project') ctx.openProjectDetail(item.id, item.name, config.screen);
            else if (kind === 'note') {
              ctx.selectNote(item.id, item.name, config.screen);
              ctx.openPage(item.id, item.name, config.screen);
            } else if (kind === 'tag') ctx.openTagNotes(item.id, item.name, config.screen);
            else if (kind === 'project-pick') ctx.pickProject(item.id, item.name);
            else
              trace.warn('SEL', `${config.screen} row has no select kind — dead row`, {
                id: item.id,
              });
          }
        }
        return;
      }

      if (action.type === 'LONG_PRESS') {
        // The OS contextual menu is page-scoped, not row-scoped — this stashes which row was
        // highlighted so context-menu.ts's handlers have a target once the wearer picks an
        // item, without navigating anywhere itself (the overlay is OS-drawn).
        //
        // LONG_PRESS_EVENT is documented to carry the OS's own
        // currentSelectItemIndex (SDK 0.0.14+), but the desktop simulator
        // delivers it with none at all (confirmed against 0.9.3 — a bare
        // sysEvent, not a listEvent) — fall back to the last row a tap
        // resolved on this screen, and failing that, row 0: a freshly
        // entered list highlights its first row by default (the same
        // assumption the CLICK_EVENT index-0 quirk above already makes), so
        // a long-press before ever tapping anything on this screen still
        // has a sensible target. See state.lastHighlightedIndex's doc
        // comment.
        const rawIndex =
          typeof action.itemIndex === 'number'
            ? action.itemIndex
            : (state.lastHighlightedIndex[config.screen] ?? 0);
        // The index landed on a Prev/More row (or, in principle, still
        // resolved nothing) — clear any stale target so the menu (still
        // shown by the OS regardless) can't act against a leftover
        // selection.
        const item = resolveItem(rawIndex);
        if (!item) {
          trace.warn('SEL', `${config.screen} long-press has no target row`, {
            itemIndex: rawIndex,
          });
          state.selectedTask = null;
          state.selectedNote = null;
          return;
        }
        state.lastHighlightedIndex[config.screen] = rawIndex;
        const kind = resolveKind(state);
        trace.info('SEL', `${config.screen} long-press row "${item.name}"`, { id: item.id, kind });
        if (kind === 'task') {
          ctx.selectTask(
            item.id,
            item.name,
            config.screen,
            'dueDate' in item ? item.dueDate : undefined,
          );
        } else if (kind === 'note') {
          ctx.selectNote(item.id, item.name, config.screen);
        }
        // 'project' / 'tag' / 'project-pick' screens declare no menu (menuFor() above), so a
        // long-press there has nothing to stash.
        return;
      }

      // HIGHLIGHT_MOVE: swiping past the current page's top/bottom row turns
      // the page when the firmware delivers the gesture. A no-op when
      // there's only one page (the common case).
      ctx.turnListPage(config.screen, action.direction === 'down' ? 1 : -1, totalPages);
    },
  };
}
