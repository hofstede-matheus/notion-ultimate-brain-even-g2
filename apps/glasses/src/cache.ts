import { storageGet, storageSet } from 'even-toolkit/storage';
import { trace } from './logging/trace';
import { getTenantConfig } from './tenant-config';

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

/**
 * Namespace segment identifying the current Notion workspace. Every persisted
 * key is scoped by this so switching workspaces neither reuses cached lists
 * nor — see ./offline-queue.ts — writes queued tasks into the wrong database.
 */
export function tenantPrefix(): string {
  return getTenantConfig()?.tasksDb.slice(0, 8) ?? 'unconfigured';
}

/** Cache key for a generic list-view screen — see _shared/navigation.ts's enterView(). */
export function cacheKeyForScreen(screen: string): string {
  return `notionultimatebrain:${tenantPrefix()}:${screen}`;
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
  trace.debug('CACHE', `write ${key}`, { items: items.length });
  await storageSet(key, items);
}
