/**
 * Which Notion database schema a database needs to fill each of the app's
 * four roles (tasks/notes/projects/tags) — and a pure test against a
 * database's property-type map. Runs on whichever side has the map: the web
 * settings picker (apps/glasses/src/web/screens/SettingsForm/dbSelection.ts)
 * calls this live per database to decide fit; apps/server's
 * __tests__/db-roles-drift.test.ts imports it to assert every property
 * views.ts actually filters or sorts by is listed here.
 *
 * This table exists because Notion workspaces commonly hold more than one
 * database with the same title — the stock "Projects"/"Tasks" templates
 * alongside the real Ultimate Brain ones — and the settings picker used to
 * offer them all under identical-looking names with nothing to tell them
 * apart.
 */

export type DbRole = 'tasks' | 'notes' | 'projects' | 'tags';

/** Why a database can't fill a role. `missing` is a sample; `missingCount` is the true total. */
export interface DbRoleFit {
  missing: string[];
  missingCount: number;
}

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
export const ROLE_REQUIREMENTS: Record<DbRole, RequiredProperty[]> = {
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

/** Sample size for the `missing` list in a DbRoleFit. */
const MISSING_SAMPLE = 3;

function fits(properties: Record<string, string>, req: RequiredProperty): boolean {
  for (const name of req.names) {
    const type = properties[name];
    if (type === undefined) continue;
    if (!req.types || req.types.includes(type)) return true;
  }
  return false;
}

/**
 * Tests a database's `{propertyName: propertyType}` map (as returned by
 * apps/server's /api/databases — see mappers.ts's databaseToSummary) against every role.
 * `properties === undefined` means the caller has no schema to check (an older server, or a
 * partial search result) — returns `{}`, which every caller must treat as "unknown, allow",
 * never as "fits nothing".
 */
export function evaluateRoles(properties: Record<string, string> | undefined): {
  roles?: DbRole[];
  unfit?: Partial<Record<DbRole, DbRoleFit>>;
} {
  if (!properties) return {};

  const roles: DbRole[] = [];
  const unfit: Partial<Record<DbRole, DbRoleFit>> = {};

  for (const role of Object.keys(ROLE_REQUIREMENTS) as DbRole[]) {
    const missing = ROLE_REQUIREMENTS[role]
      .filter((req) => !fits(properties, req))
      .map((req) => req.names[0]);

    if (missing.length === 0) {
      roles.push(role);
    } else {
      unfit[role] = { missing: missing.slice(0, MISSING_SAMPLE), missingCount: missing.length };
    }
  }

  return { roles, unfit };
}
