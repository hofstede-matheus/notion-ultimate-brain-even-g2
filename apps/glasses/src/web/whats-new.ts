/**
 * "What's new" card shown on the phone's status screen — tells someone who
 * already knows the app that a gesture moved, once, until they dismiss it.
 * Persistence mirrors services/config.ts's bridge/localStorage fallback;
 * kept off TenantConfig for the same reason voice-config.ts and the db
 * picker's own state are — this is UI-only, never sent over the wire.
 */

import { getBridge } from '../state';

const STORAGE_KEY = 'notionultimatebrain:whatsnew-dismissed';

export interface WhatsNewEntry {
  id: string;
  title: string;
  bullets: string[];
}

/**
 * A stable id for this card — deliberately NOT keyed on `__APP_VERSION__`:
 * release-please only bumps the version once this feature's commit lands, so
 * the shipping version number isn't known while writing the card. Add a new
 * entry (with a new id) the next time something is worth telling a returning
 * user about; this one stays dismissed on its own id forever after.
 */
export const WHATS_NEW_ENTRY: WhatsNewEntry = {
  id: 'context-menu',
  title: "What's new",
  bullets: [
    'Tapping a task or note opens its details.',
    'From there, hold to mark a task done — with a confirmation, no menu needed.',
    'Tap and hold for the rest: open the page, change the due date or project, delete.',
  ],
};

/** True once `entryId` has been dismissed. */
export function isDismissed(dismissedIds: readonly string[], entryId: string): boolean {
  return dismissedIds.includes(entryId);
}

/** Loaded dismissed-ids list, or `[]` on a missing/corrupt/unreadable value — a storage failure
 *  must never blank the screen or crash, only fall back to "nothing dismissed yet". */
export async function loadDismissedWhatsNew(): Promise<string[]> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(STORAGE_KEY) : window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

/** Best-effort — same as services/config.ts. A save that fails just means the card reappears
 *  next launch, not a crash. */
export async function dismissWhatsNew(entryId: string): Promise<void> {
  const existing = await loadDismissedWhatsNew();
  if (isDismissed(existing, entryId)) return;
  const raw = JSON.stringify([...existing, entryId]);
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(STORAGE_KEY, raw);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // ignore
  }
}
