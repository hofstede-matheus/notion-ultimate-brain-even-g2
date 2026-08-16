interface RequiredProperty {
  /** Accepted property names, in preference order — mirrors pageTitle()'s Name/Task/Title fallback. */
  names: [string, ...string[]];
  /** Accepted Notion property types. Omitted for sort-only properties: Notion sorts on
   *  formulas, rollups and last_edited_time alike, so pinning a type there would reject a
   *  legitimate database over an implementation detail nothing here relies on. */
  types?: string[];
}

const TITLE: RequiredProperty = { names: ['Name', 'Task', 'Title'], types: ['title'] };

/**
 * Derived strictly from what apps/server/src/views.ts, routes.ts and mappers.ts actually
 * filter, sort, write or read back. db-roles-drift.test.ts (apps/server) asserts every
 * property named in views.ts's filters/sorts appears here — keep this table and that one
 * in sync.
 */
export const ROLE_REQUIREMENTS: Record<
  'tasks' | 'notes' | 'projects' | 'tags',
  RequiredProperty[]
> = {
  tasks: [
    TITLE,
    { names: ['Status'], types: ['status'] }, // views.ts TASK_VIEWS status filters
    { names: ['Due'], types: ['date'] }, // views.ts TASK_VIEWS due filters/sorts
    { names: ['Snooze'], types: ['date'] }, // views.ts inbox view
    { names: ['Project'], types: ['relation'] }, // views.ts inbox view + routes.ts tasksForProjectRoute
    { names: ['Created'] }, // views.ts inbox sort
    { names: ['Sub-Task Sorter'] }, // views.ts next-7-days/tomorrow sort
  ],
  notes: [
    TITLE,
    { names: ['Archived'], types: ['checkbox'] },
    { names: ['Favorite'], types: ['checkbox'] },
    { names: ['Type'], types: ['select'] }, // notes' Type is a select (contrast tags' Type below)
    { names: ['URL'], types: ['url'] },
    { names: ['Tag'], types: ['relation'] },
    { names: ['Project'], types: ['relation'] },
    { names: ['Content'], types: ['relation'] },
    { names: ['Updated'] }, // views.ts sort
    { names: ['Note Date'] }, // views.ts meetings/journal sort
  ],
  projects: [
    TITLE,
    { names: ['Archived'], types: ['checkbox'] },
    { names: ['Status'], types: ['status'] },
    { names: ['Meta'] }, // views.ts PROJECT_VIEWS sort — the property behind this incident
    { names: ['Latest Activity'] }, // views.ts board/archived sort
    { names: ['Target Deadline'] }, // views.ts board sort
  ],
  tags: [
    TITLE,
    { names: ['Archived'], types: ['checkbox'] },
    { names: ['Favorite'], types: ['checkbox'] },
    // Tags' Type is a status property, not select — see CLAUDE.md's gotcha; same trap as
    // TASK_STATUS_TODO/DONE and PROJECT_STATUS_* in views.ts.
    { names: ['Type'], types: ['status'] },
    { names: ['Latest Activity'] }, // views.ts recent sort
  ],
};
