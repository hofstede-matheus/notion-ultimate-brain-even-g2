/**
 * Pure selection logic for the settings form's four database dropdowns —
 * split out from SettingsForm.tsx so it's unit-testable without a component
 * test harness (none exists in this repo yet; see vitest.config.ts's
 * `src/__tests__/**` include).
 */

import { type DbRole, evaluateRoles, type NotionDatabaseSummary } from '@notion-ub/contracts';

export type DbSlotKey = 'tasksDb' | 'notesDb' | 'projectsDb' | 'tagsDb';

export const SLOT_ROLE: Record<DbSlotKey, DbRole> = {
  tasksDb: 'tasks',
  notesDb: 'notes',
  projectsDb: 'projects',
  tagsDb: 'tags',
};

export interface DbSlotDef {
  key: DbSlotKey;
  label: string;
}

export const DB_SLOTS: DbSlotDef[] = [
  { key: 'tasksDb', label: 'Tasks Database' },
  { key: 'notesDb', label: 'Notes Database' },
  { key: 'projectsDb', label: 'Projects Database' },
  { key: 'tagsDb', label: 'Tags Database' },
];

/** '' means "not yet chosen" for a slot. */
export type DbSelection = Record<DbSlotKey, string>;

export const EMPTY_SELECTION: DbSelection = {
  tasksDb: '',
  notesDb: '',
  projectsDb: '',
  tagsDb: '',
};

/**
 * Options for one slot's dropdown: every fetched database, minus whichever
 * are already chosen in the *other* three slots — so the same database can
 * never be picked for two slots. The slot's own current choice stays in its
 * own list so it renders as selected.
 */
export function availableOptionsFor(
  slot: DbSlotKey,
  databases: NotionDatabaseSummary[],
  selection: DbSelection,
): NotionDatabaseSummary[] {
  const takenByOthers = new Set(
    DB_SLOTS.filter((s) => s.key !== slot)
      .map((s) => selection[s.key])
      .filter((id) => id !== ''),
  );
  return databases.filter((db) => !takenByOthers.has(db.id));
}

export function isSelectionComplete(selection: DbSelection): boolean {
  return DB_SLOTS.every((s) => selection[s.key] !== '');
}

/**
 * Drops any selected id that no longer appears in a freshly-fetched database
 * list (e.g. a previously-picked database was unshared or deleted) — forces
 * that slot back to "not chosen" rather than silently keeping a stale id.
 */
export function reconcileSelection(
  selection: DbSelection,
  databases: NotionDatabaseSummary[],
): DbSelection {
  const knownIds = new Set(databases.map((db) => db.id));
  const next = { ...selection };
  for (const slot of DB_SLOTS) {
    if (next[slot.key] !== '' && !knownIds.has(next[slot.key])) next[slot.key] = '';
  }
  return next;
}

// ---------------------------------------------------------------------------
// Schema-aware fit — tells apart databases that share a name (e.g. Notion's
// stock "Projects" template alongside the real Ultimate Brain one) by
// checking each database's actual properties against what apps/server's
// views.ts needs for that slot's role. See @notion-ub/contracts's db-roles.ts
// for the requirement table and apps/server/src/mappers.ts for where
// `db.properties` comes from.
// ---------------------------------------------------------------------------

/**
 * Whether `db` has the schema `slot`'s role needs. `db.properties === undefined` (an older
 * server that hasn't shipped the field yet) means there is nothing to check — fails open,
 * reproducing today's "every database is offered" behaviour rather than hiding everything.
 */
export function fitsSlot(db: NotionDatabaseSummary, slot: DbSlotKey): boolean {
  const { roles } = evaluateRoles(db.properties);
  if (!roles) return true;
  return roles.includes(SLOT_ROLE[slot]);
}

/**
 * "This database is missing Meta, Latest Activity. …" — null when `db` fits `slot`, or fitness
 * is unknown. Every missing property is named, not a sample: this string is the only place the
 * user learns what to rename in Notion.
 *
 * The consequence is a failed load, not an empty list — Notion rejects a query whose filter or
 * sort names a property the database doesn't have, so the view errors rather than returning
 * zero rows (see apps/server/src/views.ts and glasses/modules/_shared/screen-factories.ts's
 * LOAD_FAILED_MESSAGE).
 */
export function unfitReason(db: NotionDatabaseSummary, slot: DbSlotKey): string | null {
  const { unfit } = evaluateRoles(db.properties);
  const fit = unfit?.[SLOT_ROLE[slot]];
  if (!fit) return null;

  return `This database is missing ${fit.missing.join(', ')}. Lists that use them won't load on the glasses.`;
}

/** availableOptionsFor(...) narrowed to databases that fit `slot`'s role. */
export function compatibleOptionsFor(
  slot: DbSlotKey,
  databases: NotionDatabaseSummary[],
  selection: DbSelection,
): NotionDatabaseSummary[] {
  return availableOptionsFor(slot, databases, selection).filter((db) => fitsSlot(db, slot));
}

/**
 * The options one slot's dropdown offers: narrowed to schema-fitting databases unless `showAll`,
 * but *always* including the slot's own current choice, fitting or not.
 *
 * That last part is not cosmetic. even-toolkit's Select renders its placeholder when `value`
 * isn't among `options`, so an unfit database confirmed through the "Save anyway" gate came back
 * looking unselected on the next open — a saved, in-use choice displayed as if it had been
 * thrown away (issue #38). Filtering over availableOptionsFor keeps the fetched order and the
 * cross-slot exclusion, which never applies to the slot's own id.
 */
export function optionsForSlot(
  slot: DbSlotKey,
  databases: NotionDatabaseSummary[],
  selection: DbSelection,
  showAll: boolean,
): NotionDatabaseSummary[] {
  const available = availableOptionsFor(slot, databases, selection);
  if (showAll) return available;
  return available.filter((db) => fitsSlot(db, slot) || db.id === selection[slot]);
}

/**
 * Fills only *empty* slots that have exactly one compatible candidate — loops to a fixed
 * point, since resolving one slot removes that database from the other three's candidate
 * pools and can turn a 2-candidate slot into a 1-candidate one. Never touches a slot that
 * already holds a value, fitting or not — silently overriding a user's (or a previously
 * saved) choice is the failure mode this whole feature exists to avoid.
 */
export function autoSelect(
  databases: NotionDatabaseSummary[],
  selection: DbSelection,
): DbSelection {
  let next = selection;
  let changed = true;
  while (changed) {
    changed = false;
    for (const slot of DB_SLOTS) {
      if (next[slot.key] !== '') continue;
      const candidates = compatibleOptionsFor(slot.key, databases, next);
      if (candidates.length === 1) {
        next = { ...next, [slot.key]: candidates[0].id };
        changed = true;
      }
    }
  }
  return next;
}

/** Slots holding an id that exists in `databases` but doesn't fit that slot's role. */
export function unfitSlots(
  selection: DbSelection,
  databases: NotionDatabaseSummary[],
): DbSlotKey[] {
  const byId = new Map(databases.map((db) => [db.id, db]));
  return DB_SLOTS.filter((slot) => {
    const db = selection[slot.key] && byId.get(selection[slot.key]);
    return db ? !fitsSlot(db, slot.key) : false;
  }).map((slot) => slot.key);
}
