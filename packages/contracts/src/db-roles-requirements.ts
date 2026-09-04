interface RequiredProperty {
  /** Accepted property names, in preference order — mirrors pageTitle()'s Name/Task/Title fallback. */
  names: [string, ...string[]];
  /** Accepted Notion property types. Omitted for sort-only properties: Notion sorts on
   *  formulas, rollups and last_edited_time alike, so pinning a type there would reject a
   *  legitimate database over an implementation detail nothing here relies on. */
  types?: string[];
  /**
   * View paths (this role's `ViewConfig.path` in apps/server/src/views.ts) whose filter or sort
   * names this property — the views that fail to load if it's missing, not merely degraded.
   * `names[0]` must be the literal name views.ts actually hardcodes wherever this is non-empty;
   * db-roles-drift.test.ts checks both against views.ts directly.
   */
  views: string[];
}

/**
 * Title is required by every role for row labels (pageTitle()'s Name/Task/Title fallback), but
 * only breaks a *query* where a view happens to sort on the literal property name 'Name' —
 * tasks' `today` and tags' `a-z`/`types/*` do; nothing else does. Not a bare constant like the
 * other requirements because that `views` list differs per role.
 */
function titleReq(views: string[]): RequiredProperty {
  return { names: ['Name', 'Task', 'Title'], types: ['title'], views };
}

/**
 * Derived strictly from what apps/server/src/views.ts, routes.ts and mappers.ts actually
 * filter, sort, write or read back. db-roles-drift.test.ts (apps/server) asserts every
 * property named in views.ts's filters/sorts appears here, against the exact view(s) that
 * name it — keep this table and that one in sync.
 */
export const ROLE_REQUIREMENTS: Record<
  'tasks' | 'notes' | 'projects' | 'tags',
  RequiredProperty[]
> = {
  tasks: [
    titleReq(['today']), // views.ts TASK_VIEWS 'today' sort
    { names: ['Status'], types: ['status'], views: ['inbox', 'today', 'next-7-days', 'tomorrow'] },
    { names: ['Due'], types: ['date'], views: ['today', 'next-7-days', 'tomorrow'] },
    { names: ['Snooze'], types: ['date'], views: ['inbox'] },
    {
      names: ['Project'],
      types: ['relation'], // also routes.ts tasksForProjectRoute
      views: ['inbox', 'today', 'next-7-days', 'tomorrow'],
    },
    { names: ['Created'], views: ['inbox'] },
    { names: ['Sub-Task Sorter'], views: ['next-7-days', 'tomorrow'] },
  ],
  notes: [
    titleReq([]), // never filtered or sorted on for notes
    {
      names: ['Archived'],
      types: ['checkbox'],
      views: [
        'inbox',
        'favorites',
        'by-tag',
        'notes',
        'meetings',
        'by-project',
        'clips',
        'voice',
        'journal',
        'all',
      ],
    },
    { names: ['Favorite'], types: ['checkbox'], views: ['favorites'] },
    {
      names: ['Type'], // notes' Type is a select (contrast tags' Type below)
      types: ['select'],
      views: ['inbox', 'by-tag', 'notes', 'meetings', 'by-project', 'clips', 'voice', 'journal'],
    },
    { names: ['URL'], types: ['url'], views: ['by-tag', 'notes', 'by-project', 'clips'] },
    { names: ['Tag'], types: ['relation'], views: ['inbox', 'notes'] },
    { names: ['Project'], types: ['relation'], views: ['inbox', 'notes'] },
    { names: ['Content'], types: ['relation'], views: ['inbox', 'by-tag', 'notes', 'by-project'] },
    {
      names: ['Updated'],
      views: ['inbox', 'by-tag', 'notes', 'by-project', 'clips', 'voice', 'all'],
    },
    { names: ['Note Date'], views: ['meetings', 'journal'] },
  ],
  projects: [
    titleReq([]), // never filtered or sorted on for projects
    {
      names: ['Archived'],
      types: ['checkbox'],
      views: ['all', 'doing', 'ongoing', 'planned', 'on-hold', 'done', 'board', 'archived'],
    },
    {
      names: ['Status'],
      types: ['status'],
      views: ['doing', 'ongoing', 'planned', 'on-hold', 'done'],
    },
    {
      names: ['Meta'], // the property behind the incident #38/#40 trace back to
      views: ['all', 'doing', 'ongoing', 'planned', 'on-hold', 'done'],
    },
    { names: ['Latest Activity'], views: ['board', 'archived'] },
    { names: ['Target Deadline'], views: ['board'] },
  ],
  tags: [
    titleReq(['a-z', 'types/area', 'types/resource', 'types/entity']),
    {
      names: ['Archived'],
      types: ['checkbox'],
      views: ['recent', 'favorites', 'a-z', 'types/area', 'types/resource', 'types/entity'],
    },
    { names: ['Favorite'], types: ['checkbox'], views: ['favorites'] },
    // Tags' Type is a status property, not select — see CLAUDE.md's gotcha; same trap as
    // TASK_STATUS_TODO/DONE and PROJECT_STATUS_* in views.ts.
    {
      names: ['Type'],
      types: ['status'],
      views: ['types/area', 'types/resource', 'types/entity'],
    },
    { names: ['Latest Activity'], views: ['recent'] },
  ],
};

export interface RoleView {
  path: string;
  /** User-facing name for the settings picker's fit warning. No canonical source exists to pull
   *  this from — on-device labels are scattered across each domain's screens/menu.ts, keyed by
   *  screen name, not view path — so this is its own small, hand-authored table, matching those
   *  labels where a view has an on-device menu entry. */
  label: string;
}

/** Every view per role, in apps/server/src/views.ts declaration order — the population evaluateRoles()
 *  filters down to build DbRoleFit.brokenViews. */
export const ROLE_VIEWS: Record<'tasks' | 'notes' | 'projects' | 'tags', RoleView[]> = {
  tasks: [
    { path: 'inbox', label: 'Inbox' },
    { path: 'today', label: 'Today' },
    { path: 'next-7-days', label: 'Next 7 Days' },
    { path: 'tomorrow', label: 'Tomorrow' },
  ],
  notes: [
    { path: 'inbox', label: 'Inbox' },
    { path: 'favorites', label: 'Favorites' },
    { path: 'by-tag', label: 'By Tag' },
    { path: 'notes', label: 'Notes' },
    { path: 'meetings', label: 'Meetings' },
    { path: 'by-project', label: 'By Project' },
    { path: 'clips', label: 'Clips' },
    { path: 'voice', label: 'Voice' },
    { path: 'journal', label: 'Journal' },
    { path: 'all', label: 'All' },
  ],
  projects: [
    { path: 'all', label: 'All' },
    { path: 'doing', label: 'Doing' },
    { path: 'ongoing', label: 'Ongoing' },
    { path: 'planned', label: 'Planned' },
    { path: 'on-hold', label: 'On Hold' },
    { path: 'done', label: 'Done' },
    // Not a top-level menu item — reached via the project picker when assigning a task/note —
    // but it is a real query, so it belongs here. Label matches its own screen title.
    { path: 'board', label: 'Project Board' },
    { path: 'archived', label: 'Archived' },
  ],
  tags: [
    { path: 'recent', label: 'Recent' },
    { path: 'favorites', label: 'Favorites' },
    { path: 'a-z', label: 'A-Z' },
    { path: 'types/area', label: 'Area' },
    { path: 'types/resource', label: 'Resource' },
    { path: 'types/entity', label: 'Entity' },
  ],
};
