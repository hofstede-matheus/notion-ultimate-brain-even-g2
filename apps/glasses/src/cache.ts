import { storageGet, storageSet } from 'even-toolkit/storage';

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

/** Cache key for a generic list-view screen — see _shared/navigation.ts's enterView(). */
export function cacheKeyForScreen(screen: string): string {
  return `notionultimatebrain:${screen}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a cached list from the bridge's local storage.
 * Returns null when there is no entry or the stored value can't be parsed.
 */
export async function loadCachedList<T>(key: string): Promise<T[] | null> {
  const parsed = await storageGet<unknown>(key, null);
  return Array.isArray(parsed) ? (parsed as T[]) : null;
}

/**
 * Persist a list to the bridge's local storage.
 * Failures are swallowed — cache writes are best-effort.
 */
export async function saveCachedList<T>(key: string, items: T[]): Promise<void> {
  await storageSet(key, items);
}
