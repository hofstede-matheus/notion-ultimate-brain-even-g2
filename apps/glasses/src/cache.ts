import { getBridge } from './state'

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

/** Cache key for a generic list-view screen — see context.ts's enterView(). */
export function cacheKeyForScreen(screen: string): string {
  return `notionultimatebrain:${screen}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a cached list from the bridge's local storage.
 * Returns null when there is no entry or the stored value can't be parsed.
 */
export async function loadCachedList<T>(key: string): Promise<T[] | null> {
  const b = getBridge()
  if (!b) return null
  try {
    const raw = await b.getLocalStorage(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed as T[]
  } catch {
    return null
  }
}

/**
 * Persist a list to the bridge's local storage.
 * Failures are swallowed — cache writes are best-effort.
 */
export async function saveCachedList<T>(key: string, items: T[]): Promise<void> {
  const b = getBridge()
  if (!b) return
  try {
    await b.setLocalStorage(key, JSON.stringify(items))
  } catch {
    // ignore
  }
}
