import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { Note, Project, Tag, Task } from '@notion-ub/contracts';

export type ScreenName =
  | 'booting'
  | 'setup-needed'
  | 'boot-error'
  | 'menu'
  | 'tasks-menu'
  | 'notes-menu'
  | 'projects-menu'
  | 'tags-menu'
  | 'overdue'
  | 'today'
  | 'inbox'
  | 'add-task'
  | 'tasks-next-7-days'
  | 'tasks-tomorrow'
  | 'notes-inbox'
  | 'notes-favorites'
  | 'notes-by-tag'
  | 'notes-list'
  | 'notes-meetings'
  | 'notes-by-project'
  | 'notes-clips'
  | 'notes-voice'
  | 'notes-journal'
  | 'notes-all'
  | 'projects-all'
  | 'projects-doing'
  | 'projects-ongoing'
  | 'projects-planned'
  | 'projects-on-hold'
  | 'projects-done'
  | 'projects-board'
  | 'projects-archived'
  | 'tags-recent'
  | 'tags-favorites'
  | 'tags-a-z'
  | 'tag-types-menu'
  | 'tags-types-area'
  | 'tags-types-resource'
  | 'tags-types-entity'
  | 'tag-notes'
  | 'mark-done-confirm'
  | 'mark-done-toast'
  | 'task-actions'
  | 'task-details'
  | 'task-due-date'
  | 'due-date-confirm'
  | 'due-date-toast'
  | 'note-actions'
  | 'note-details'
  | 'page-content'
  | 'delete-confirm'
  | 'delete-toast'
  | 'project-picker'
  | 'set-project-confirm'
  | 'set-project-toast'
  | 'project-detail'
  | 'project-tasks-menu'
  | 'project-tasks-todo'
  | 'project-tasks-done'
  | 'project-notes';

export type RecordingState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'confirm'
  | 'confirming'
  | 'done'
  | 'error';

/** Anything a generic list screen can render — every domain record has a `name`. */
export type ListItem = Task | Note | Project | Tag;

export interface AppState {
  screen: ScreenName;
  startupRendered: boolean;

  // Fetched list data for every list-view screen (Today/Overdue/Inbox and
  // every Tasks/Notes/Projects/Tags view), keyed by screen name. Today and
  // Overdue are both filtered views over the same fetched array, stored
  // under the 'today' key — see _shared/navigation.ts's DATA_KEY_OVERRIDES.
  // Holds the *complete* fetched list — the 20-item native display cap is
  // applied at render time, not here (see screen-factories.ts's paginateItems).
  lists: Partial<Record<ScreenName, ListItem[]>>;

  // Current 0-based display page per list screen (each screen's list is
  // shown MAX_LIST_ITEMS at a time — see screen-factories.ts). Reset to 0
  // whenever a screen is freshly entered via enterView().
  listPages: Partial<Record<ScreenName, number>>;

  // Confirm dialog for a mutating item action — kind is 'markDone' (tasks
  // only), 'delete' (tasks and notes), 'setDue' (tasks only), or 'setProject'
  // (tasks and notes); returnTo is the list screen to navigate back to.
  // Generic over item id/name since "Delete" is shared by both the task and
  // the note action menus. `date` is only set for 'setDue' — the ISO date to
  // write, or null to clear it. `project` is only set for 'setProject' — the
  // project to write (id null clears the relation), and its name for display.
  pendingAction: {
    kind: 'markDone' | 'delete' | 'setDue' | 'setProject';
    itemId: string;
    itemName: string;
    returnTo: ScreenName;
    date?: string | null;
    project?: { id: string | null; name: string };
  } | null;

  // The task the action menu / details / delete flow is operating on.
  // `dueDate` (if known from the list row that led here) seeds the due-date
  // picker's initial cursor and "current due" marker without an extra fetch.
  selectedTask: {
    taskId: string;
    taskName: string;
    returnTo: ScreenName;
    dueDate?: string;
  } | null;

  // The due-date picker (bitmap calendar) for the task in `selectedTask`.
  // Navigation is two-phase: 'week' moves rowIndex over 0 (prev-month nav),
  // 1-6 (week rows), 7 (next-month nav); 'day' fixes rowIndex at the entered
  // week and moves colIndex 0-6. viewYear/viewMonth is the month currently
  // displayed (1-based month), independent of `todayIso`.
  dueDatePicker: {
    taskId: string;
    taskName: string;
    returnTo: ScreenName;
    viewYear: number;
    viewMonth: number;
    phase: 'week' | 'day';
    rowIndex: number;
    colIndex: number;
    todayIso: string;
    dueIso: string | null;
  } | null;

  // Details screen data (fetched on demand).
  taskDetails: {
    loading: boolean;
    project: string | null;
    due: string | null;
    error: string;
  } | null;

  // The note the action menu / details / delete flow is operating on —
  // mirrors selectedTask/taskDetails, kept as its own pair rather than
  // merged with the task versions since the two menus offer different
  // actions and a note's details have no Due date to carry.
  selectedNote: { noteId: string; noteName: string; returnTo: ScreenName } | null;

  noteDetails: {
    loading: boolean;
    project: string | null;
    error: string;
  } | null;

  // Page reader data (fetched on demand). Any Notion page can be read — a
  // task via its action menu, a note by tapping it — so the reader carries its
  // own `title` and `returnTo` rather than reading them off whichever
  // selection led here. The blocks arrive already parsed into `pages` (one
  // screenful of display lines each, since the firmware can't be handed a
  // whole document at once); `index` is the screenful currently shown.
  pageContent: {
    loading: boolean;
    title: string;
    returnTo: ScreenName;
    pages: string[][];
    index: number;
    error: string;
  } | null;

  // Item action toast (mark-done, delete, setDue, or setProject); shown after
  // API call completes.
  actionToast: {
    kind: 'markDone' | 'delete' | 'setDue' | 'setProject';
    itemName: string;
    returnTo: ScreenName;
    untilMs: number;
    date?: string | null;
    project?: { id: string | null; name: string };
  } | null;

  // The item (task or note) the project picker / confirm / toast flow is
  // operating on — mirrors selectedTask/selectedNote. `returnTo` is the list
  // screen to land back on after the toast; `backTo` is the action menu
  // ('task-actions' or 'note-actions') GO_BACK from the picker returns to.
  projectPicker: {
    itemId: string;
    itemName: string;
    returnTo: ScreenName;
    backTo: ScreenName;
  } | null;

  // The project the Tasks/Notes drill-down menu (and its two list screens)
  // is currently scoped to — returnTo is the Projects list screen to
  // navigate back to (Active/Planned/Board/Archived).
  selectedProject: { id: string; name: string; returnTo: ScreenName } | null;

  // The tag the tag-notes list screen is currently scoped to — returnTo is
  // whichever tags list screen the tap came from (Recent/Fav./A-Z/one of the
  // Types leaves), since a tag can be reached from any of them.
  selectedTag: { id: string; name: string; returnTo: ScreenName } | null;

  // Voice recording
  recording: RecordingState;
  createdTaskName: string;
  pendingTranscript: string;

  // Loading / background refresh
  loading: boolean; // true = no cache yet, first fetch in flight
  spinnerFrame: string; // current spinner char ('|','/','-','\\'); empty = not spinning
  errorMessage: string;
}

export const state: AppState = {
  screen: 'menu',
  startupRendered: false,
  lists: {},
  listPages: {},
  pendingAction: null,
  selectedTask: null,
  dueDatePicker: null,
  taskDetails: null,
  selectedNote: null,
  noteDetails: null,
  projectPicker: null,
  pageContent: null,
  actionToast: null,
  selectedProject: null,
  selectedTag: null,
  recording: 'idle',
  createdTaskName: '',
  pendingTranscript: '',
  loading: false,
  spinnerFrame: '',
  errorMessage: '',
};

let _bridge: EvenAppBridge | null = null;

export function getBridge(): EvenAppBridge | null {
  return _bridge;
}

export function setBridge(b: EvenAppBridge): void {
  _bridge = b;
}
