/**
 * Self-heal for a stored tenant config that has stopped working — e.g. the settings picker
 * (before this feature existed) let a "Projects" database be selected that turns out to be a
 * same-named decoy missing properties the app needs (see @notion-ub/contracts's db-roles.ts).
 *
 * Deliberately lazy: only runs after a list refresh actually fails in a config-shaped way (see
 * reportApiFailure, called from _shared/navigation.ts's enterView), never on boot. boot.ts
 * already serialises bridge-wait -> splash hold -> menu, and a mandatory /api/databases round
 * trip (a many-database search loop) would put a network dependency on the critical path of an
 * app that otherwise starts fine from cache and offline. A wedged config is rare and sticky —
 * paying for it on every launch is the wrong trade. __tests__/glasses/boot.test.ts pins "boot
 * makes no /api/databases call" so this stays true.
 */

import { ApiError } from './api';
import { trace } from './logging/trace';
import { state } from './state';
import { getTenantConfig } from './tenant-config';
import { setStatus } from './web/providers/uiController';
import { type DbSlotKey, fitsSlot } from './web/screens/SettingsForm/dbSelection';
import { fetchDatabases } from './web/services/databases';

/** At most one check per app session — a wedged config doesn't un-wedge itself mid-session,
 *  so repeating the check on every subsequent failure would just be wasted network calls. */
let checkedThisSession = false;

/** Notion error codes that plausibly mean "the chosen database is wrong", not "the network
 *  hiccuped" or "Notion is having an outage" — see apps/server/src/routes.ts's invokeRoute,
 *  which is what attaches `code` to a failed response in the first place. */
function looksConfigShaped(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.code === 'validation_error' || err.code === 'object_not_found')
  );
}

/**
 * Called from a list/action failure path. No-op unless the failure looks like a configuration
 * mistake, and at most once per session. Fire-and-forget — a list screen's failure handling
 * doesn't wait on this.
 */
export function reportApiFailure(err: unknown): void {
  if (checkedThisSession || !looksConfigShaped(err)) return;
  checkedThisSession = true;
  void runCheck();
}

/** Test-only: resets the once-per-session guard. See logging/redact.ts's
 *  _clearRegisteredSecretsForTests for the same pattern. */
export function _resetSessionForTests(): void {
  checkedThisSession = false;
}

/**
 * Which of the four stored database ids no longer fit their role. Empty means the config is
 * fine (or a database went missing entirely — reconcileSelection's job, not this one).
 */
export async function checkTenantConfig(): Promise<DbSlotKey[]> {
  const cfg = getTenantConfig();
  if (!cfg) return [];

  const databases = await fetchDatabases(cfg.token);
  const byId = new Map(databases.map((db) => [db.id, db]));
  const ids: Record<DbSlotKey, string> = {
    tasksDb: cfg.tasksDb,
    notesDb: cfg.notesDb,
    projectsDb: cfg.projectsDb,
    tagsDb: cfg.tagsDb,
  };

  return (Object.keys(ids) as DbSlotKey[]).filter((slot) => {
    const db = byId.get(ids[slot]);
    // A vanished database (unshared/deleted) isn't this function's signal to raise — that's
    // reconcileSelection's job, next time Settings opens. Only flag a database that's present
    // but doesn't fit.
    return db ? !fitsSlot(db, slot) : false;
  });
}

async function runCheck(): Promise<void> {
  try {
    const bad = await checkTenantConfig();
    if (bad.length === 0) return;

    trace.error('CFG', 'stored tenant config no longer fits', { slots: bad });
    state.configSuspect = true;
    setStatus('Your Notion setup needs attention — check settings.');

    // Dynamic, not static: boot.ts (via glasses/events -> router -> every screen module,
    // including this file's own caller, _shared/navigation.ts) and glasses/events both loop
    // back to this module's importer. A static import here would be a real circular import
    // — deferring to call time (this only runs on a config-shaped failure, not on every
    // boot) keeps the module graph acyclic for everyone else.
    const [{ reconfigure }, { showGlassesScreen }] = await Promise.all([
      import('./boot'),
      import('./glasses/events'),
    ]);

    const applied = await reconfigure(getTenantConfig());
    if (!applied) return; // user cancelled — configSuspect stays true, glasses text stays upgraded

    state.lists = {};
    state.listPages = {};
    state.listStatus = {};
    state.configSuspect = false;
    if (state.startupRendered) await showGlassesScreen('menu');
  } catch (e) {
    // Best-effort — a network hiccup while checking must not cascade into its own failure.
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    trace.warn('CFG', 'config health check failed, leaving stored config as-is', { error: msg });
  }
}
