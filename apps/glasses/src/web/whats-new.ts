/**
 * "What's new" card shown on the phone's status screen: the current release's
 * CHANGELOG.md section, shown once per app version until the wearer dismisses it.
 *
 * The content is never written by hand. vite.config.ts parses the newest
 * CHANGELOG.md section at build time (build/changelog.ts) and bakes it in as
 * `__RELEASE_NOTES__`. release-please writes that section and bumps the version
 * in the same commit. The only way to change a bullet is the commit subject.
 *
 * Dismissal stores the version that was dismissed, so every update shows its
 * own notes once with no id to remember. Persistence mirrors services/config.ts's
 * bridge/localStorage fallback. It is kept off TenantConfig for the same reason
 * voice-config.ts and the db picker's own state are: UI-only, never sent over the wire.
 */

import type { ReleaseNotes } from '../build/changelog';
import { getBridge } from '../state';

const STORAGE_KEY = 'notionultimatebrain:whatsnew-seen-version';

/** The notes baked into this build, or `null` in a dev build whose changelog doesn't match. */
export const RELEASE_NOTES: ReleaseNotes | null = __RELEASE_NOTES__;

/** The version this build reports, and the one "Got it" stores. */
export const APP_VERSION: string = __APP_VERSION__;

/** True when there is something to show and this version hasn't been dismissed yet. */
export function shouldShowWhatsNew(
  notes: ReleaseNotes | null,
  currentVersion: string,
  seenVersion: string | null,
): boolean {
  if (!notes || notes.groups.length === 0) return false;
  return seenVersion !== currentVersion;
}

/** The last dismissed version, or `null` on a missing/unreadable value. A storage failure
 *  must never blank the screen or crash, only fall back to "nothing dismissed yet". */
export async function loadSeenWhatsNewVersion(): Promise<string | null> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(STORAGE_KEY) : window.localStorage.getItem(STORAGE_KEY);
    return raw ? raw : null;
  } catch {
    return null;
  }
}

/** Best-effort, same as services/config.ts. A save that fails just means the card reappears
 *  next launch, not a crash. */
export async function dismissWhatsNew(version: string): Promise<void> {
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(STORAGE_KEY, version);
    else window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // ignore
  }
}
