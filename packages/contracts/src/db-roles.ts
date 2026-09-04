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

import { ROLE_REQUIREMENTS, ROLE_VIEWS } from './db-roles-requirements';

export type DbRole = keyof typeof ROLE_REQUIREMENTS;

/**
 * Why a database can't fill a role, and what actually breaks because of it.
 *
 * `missing` is complete, not a sample — the settings picker renders it verbatim, and it is the
 * only place a user finds out what to rename in Notion. `brokenViews`/`allViewsBroken` exist
 * because "missing a property" and "the whole role is unusable" are not the same claim: each
 * view in apps/server/src/views.ts filters or sorts on only a few properties, so one missing
 * property commonly breaks a handful of views and leaves the rest working (see issue #40).
 */
export interface DbRoleFit {
  missing: string[];
  /** Display names, in views.ts order, of every view that will fail to load — a subset of
   *  `missing`'s consequences, since some requirements (the title) affect row labels rather
   *  than any query's ability to succeed, and so break nothing here even while `missing`. */
  brokenViews: string[];
  /** True once every view for the role is in `brokenViews` — the whole role is unusable, not
   *  just some views of it. */
  allViewsBroken: boolean;
}

export { ROLE_REQUIREMENTS, ROLE_VIEWS };

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
    const unmet = ROLE_REQUIREMENTS[role].filter((req) => !fits(properties, req));

    if (unmet.length === 0) {
      roles.push(role);
      continue;
    }

    const brokenPaths = new Set(unmet.flatMap((req) => req.views));
    const roleViews = ROLE_VIEWS[role];
    const brokenViews = roleViews.filter((view) => brokenPaths.has(view.path)).map((v) => v.label);

    unfit[role] = {
      missing: unmet.map((req) => req.names[0]),
      brokenViews,
      allViewsBroken: brokenViews.length === roleViews.length,
    };
  }

  return { roles, unfit };
}
