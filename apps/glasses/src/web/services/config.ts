/** Persistence for the Notion tenant-config settings form. Best-effort, same as cache.ts. */

import type { TenantConfig } from '@notion-ub/contracts';
import { getBridge } from '../../state';
import { DB_SLOTS, type DbSlotKey } from '../screens/SettingsForm/dbSelection';

const CONFIG_KEY = 'notionultimatebrain:config';

export async function loadStoredConfig(): Promise<TenantConfig | null> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(CONFIG_KEY) : window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TenantConfig;
  } catch {
    return null;
  }
}

export async function saveStoredConfig(cfg: TenantConfig): Promise<void> {
  const raw = JSON.stringify(cfg);
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(CONFIG_KEY, raw);
    else window.localStorage.setItem(CONFIG_KEY, raw);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Database-picker state — the user's decisions *about* the picker, as opposed
// to the picked ids above. Deliberately its own key rather than fields on
// TenantConfig: that object is base64'd into the X-Notion-Config header of
// every request (see ../../tenant-config.ts's getTenantHeader), and a UI
// choice has no business on the wire. Same reasoning as ../../voice-config.ts.
// ---------------------------------------------------------------------------

const PICKER_KEY = 'notionultimatebrain:dbpicker';

export interface DbPickerState {
  /**
   * Slot -> the database id whose fit warning the user explicitly overrode with "Save anyway".
   * Keyed by id, not just by slot, so choosing a *different* unfit database warns afresh
   * instead of inheriting the previous confirmation.
   */
  overrides: Partial<Record<DbSlotKey, string>>;
  /**
   * Last state of the "Show all databases" toggle. Persisted because it is a deliberate "I know
   * my schema, stop hiding things" decision — resetting it on every open meant re-checking it
   * every time a database had to be changed.
   */
  showAll: boolean;
}

export const DEFAULT_PICKER_STATE: DbPickerState = { overrides: {}, showAll: false };

/** Keeps only `slot: string` entries for real slots — a hand-edited or half-written blob must
 *  degrade to "no override", never to a selection that can't be confirmed away. */
function parseOverrides(raw: unknown): Partial<Record<DbSlotKey, string>> {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const overrides: Partial<Record<DbSlotKey, string>> = {};
  for (const slot of DB_SLOTS) {
    const id = source[slot.key];
    if (typeof id === 'string' && id !== '') overrides[slot.key] = id;
  }
  return overrides;
}

export async function loadDbPickerState(): Promise<DbPickerState> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(PICKER_KEY) : window.localStorage.getItem(PICKER_KEY);
    if (!raw) return DEFAULT_PICKER_STATE;
    const parsed = JSON.parse(raw) as Partial<DbPickerState>;
    return {
      overrides: parseOverrides(parsed.overrides),
      showAll: parsed.showAll === true,
    };
  } catch {
    return DEFAULT_PICKER_STATE;
  }
}

export async function saveDbPickerState(state: DbPickerState): Promise<void> {
  const raw = JSON.stringify(state);
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(PICKER_KEY, raw);
    else window.localStorage.setItem(PICKER_KEY, raw);
  } catch {
    // ignore
  }
}
