import type { Note, Project, Tag, Task } from '@notion-ub/contracts';
import { addDays, format } from 'date-fns';

/**
 * Deterministic dataset for the fixture server — see fixture-server/server.ts.
 * Deliberately static (mutations are recorded, not applied) so every spec
 * sees the same list regardless of run order; see the integration README's
 * "Why fixtures don't mutate" note.
 *
 * Each spec below draws from its own view so specs never interfere with each
 * other even though they share one fixture dataset for a whole test run.
 */

// ---------------------------------------------------------------------------
// Tasks — spec 02 (task-list-loads), 03 (mark-done-round-trip), 05 (calendar)
// ---------------------------------------------------------------------------

/** A title over 63 UTF-8 bytes of accented Latin text — see constants.ts's MAX_ITEM_BYTES. */
const LONG_MULTIBYTE_TITLE =
  'Café résumé review for the naïve façade renovation project — à la carte';

// Today is a filtered view (dueDate === todayDateStr()); literal dates go stale
// the next calendar day. Use local-calendar date-fns, never toISOString().
const TODAY_DUE = format(new Date(), 'yyyy-MM-dd');
const NEXT_7_DAYS_DUE = format(addDays(new Date(), 1), 'yyyy-MM-dd');

export const TODAY_TASKS: Task[] = [
  { id: 'task-mark-done', name: 'Buy groceries', status: 'To Do', dueDate: TODAY_DUE },
  { id: 'task-due-date', name: 'Renew passport', status: 'To Do', dueDate: TODAY_DUE },
  { id: 'task-long-title', name: LONG_MULTIBYTE_TITLE, status: 'To Do', dueDate: TODAY_DUE },
];

/** 25 items — forces MAX_LIST_ITEMS (20) paging; see constants.ts. */
export const NEXT_7_DAYS_TASKS: Task[] = Array.from({ length: 23 }, (_, i) => ({
  id: `task-page-${i + 1}`,
  name: `Follow up item ${String(i + 1).padStart(2, '0')}`,
  status: 'To Do',
  dueDate: NEXT_7_DAYS_DUE,
})).concat([
  { id: 'task-page-24', name: LONG_MULTIBYTE_TITLE, status: 'To Do', dueDate: NEXT_7_DAYS_DUE },
  { id: 'task-page-25', name: 'Last item on the list', status: 'To Do', dueDate: NEXT_7_DAYS_DUE },
]);

/** Details for GET /api/pages/:id/details — spec 10. Anything absent resolves to nulls. */
export const PAGE_DETAILS: Record<string, { project: string | null; due: string | null }> = {
  'task-mark-done': { project: 'Alpha Rollout', due: TODAY_DUE },
};

// ---------------------------------------------------------------------------
// Notes — spec 04 (note-reader-paging), spec 09 (note-delete)
// ---------------------------------------------------------------------------

// Row order matters: spec 04 reads row 0, spec 09 deletes row 1. Keeping each
// spec on its own row is what lets them share this list without interfering.
export const INBOX_NOTES: Note[] = [
  { id: 'note-reader', name: 'Reading Test Note' },
  { id: 'note-delete', name: 'Disposable Note' },
];

/**
 * Plain prose long enough to span multiple reader pages
 * (READER_LINES_PER_PAGE=8 / READER_CHARS_PER_LINE=42 — see constants.ts).
 * No custom Notion export tags: the parsing of those is already covered by
 * markdown-to-pages.test.ts; this spec only needs enough real content to
 * exercise pagination and prove the reader doesn't overflow its container.
 */
export const READER_MARKDOWN = Array.from(
  { length: 6 },
  (_, i) =>
    `Paragraph ${i + 1}. This is a long line of ordinary prose meant to wrap across several ` +
    'screen-width segments so the reader has to word-wrap and paginate it correctly on real ' +
    'firmware-equivalent rendering, not just in a mocked bridge.',
).join('\n\n');

// ---------------------------------------------------------------------------
// Projects — spec 07 (drill-down, then the change-project picker)
// ---------------------------------------------------------------------------

export const DOING_PROJECTS: Project[] = [
  { id: 'project-alpha', name: 'Alpha Rollout', status: 'Doing' },
  { id: 'project-beta', name: 'Beta Migration', status: 'Doing' },
];

/** Open tasks under project-alpha, for the project → Tasks → To Do drill-down. */
export const PROJECT_TODO_TASKS: Task[] = [
  { id: 'project-task-1', name: 'Draft the rollout plan', status: 'To Do' },
  { id: 'project-task-2', name: 'Book the launch review', status: 'To Do' },
];

// ---------------------------------------------------------------------------
// Tags — spec 08 (tags-drilldown)
// ---------------------------------------------------------------------------

export const RECENT_TAGS: Tag[] = [
  { id: 'tag-health', name: 'Health' },
  { id: 'tag-finance', name: 'Finance' },
];

/** Notes carrying tag-health — the tag → notes drill-down. */
export const TAG_NOTES: Note[] = [{ id: 'tag-note-1', name: 'Annual checkup notes' }];

// ---------------------------------------------------------------------------
// Views no current spec exercises — empty is a valid, deliberate fixture, and
// keeps every list route the app can reach answering 200 rather than 501.
// ---------------------------------------------------------------------------

export const EMPTY_PROJECTS: Project[] = [];
export const EMPTY_TAGS: Tag[] = [];
