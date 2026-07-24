/**
 * Pure selection logic for the settings form's four database dropdowns —
 * split out from SettingsForm.tsx so it's unit-testable without a component
 * test harness (none exists in this repo yet; see vitest.config.ts's
 * `src/__tests__/**` include).
 */

import type { NotionDatabaseSummary } from '@notion-ub/contracts';

export type DbSlotKey = 'tasksDb' | 'notesDb' | 'projectsDb' | 'tagsDb';

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
