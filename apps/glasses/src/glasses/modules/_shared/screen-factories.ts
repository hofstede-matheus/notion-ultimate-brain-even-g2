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
  'projects-active',
  'projects-planned',
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
 * header + native list of item names. Reads from `config.selectItems(state)`
 * if given, else `state.lists[config.screen]` — both populated by
 * ctx.enterView() in _shared/navigation.ts. SELECT_HIGHLIGHTED just records the
 * cursor — there's no detail screen yet (except the task-actions/
 * project-detail dispatch below).
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

      const headerTitle = countInHeader ? `${title} (${items.length})` : title;
      const header = buildHeaderLine(headerTitle, state.spinnerFrame);
      const listItems = items
        .slice(0, MAX_LIST_ITEMS)
        .map((i) => truncateToByteLimit(formatLabel(i)));
      return { mode: 'list', header, items: listItems };
    },

    action(action, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner();
        ctx.navigate(config.parent);
        return;
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        if (typeof action.itemIndex === 'number') {
          const item = selectItems(state)[action.itemIndex];
          if (item) {
            const kind = config.onSelect ?? selectKindFor(config.screen);
            if (kind === 'task') ctx.openTaskActions(item.id, item.name, config.screen);
            else if (kind === 'project') ctx.openProjectDetail(item.id, item.name, config.screen);
            else if (kind === 'note') ctx.openNoteActions(item.id, item.name, config.screen);
          }
        }
        return;
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    },
  };
}
