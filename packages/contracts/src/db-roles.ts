/**
 * Which Notion database schema a database needs to fill each of the app's
 * four roles (tasks/notes/projects/tags) — and a pure test against a
 * database's property-type map. Runs on whichever side has the map: the web
 * settings picker (apps/glasses/src/web/screens/SettingsForm/dbSelection.ts)
 * calls this live per database to decide fit; apps/server's
 * __tests__/db-roles-drift.test.ts imports ROLE_REQUIREMENTS to assert every
 * property views.ts actually filters or sorts by is listed there.
 *
 * This table exists because Notion workspaces commonly hold more than one
 * database with the same title — the stock "Projects"/"Tasks" templates
 * alongside the real Ultimate Brain ones — and the settings picker used to
 * offer them all under identical-looking names with nothing to tell them
 * apart. The lookup data lives in db-roles-requirements.ts.
 */

import { ROLE_REQUIREMENTS } from './db-roles-requirements';

export type DbRole = keyof typeof ROLE_REQUIREMENTS;

/**
 * Why a database can't fill a role: every property the role needs that this database doesn't
 * have, under any of its accepted names and types.
 *
 * Complete, not a sample. The settings picker renders this list verbatim, and it is the only
 * place a user finds out what to rename in Notion — a customised or older Ultimate Brain can
 * miss several properties at once, and truncating the list hid the ones still to fix.
 */
export interface DbRoleFit {
  missing: string[];
}

export { ROLE_REQUIREMENTS };

function fits(
  properties: Record<string, string>,
  req: (typeof ROLE_REQUIREMENTS)[DbRole][number],
): boolean {
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
      unfit[role] = { missing };
    }
  }

  return { roles, unfit };
}
