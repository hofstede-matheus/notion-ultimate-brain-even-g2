import { getBridge } from './state'
import type { Task } from './state'

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const CACHE_KEY_TODAY = 'notionultimatebrain:today'
export const CACHE_KEY_INBOX = 'notionultimatebrain:inbox'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a cached task list from the bridge's local storage.
 * Returns null when there is no entry or the stored value can't be parsed.
 */
export async function loadCachedTasks(key: string): Promise<Task[] | null> {
  const b = getBridge()
  if (!b) return null
  try {
    const raw = await b.getLocalStorage(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed as Task[]
  } catch {
    return null
  }
}

/**
 * Persist a task list to the bridge's local storage.
 * Failures are swallowed — cache writes are best-effort.
 */
export async function saveCachedTasks(key: string, tasks: Task[]): Promise<void> {
  const b = getBridge()
  if (!b) return
  try {
    await b.setLocalStorage(key, JSON.stringify(tasks))
  } catch {
    // ignore
  }
}
