/**
 * In-memory holder for the current device's Notion tenant config (token +
 * database IDs), and the header encoding sent with every /api/* request.
 * Persistence across app restarts lives in web/settings.ts.
 */

import type { TenantConfig } from '@notion-ub/contracts'

let current: TenantConfig | null = null

export function getTenantConfig(): TenantConfig | null {
  return current
}

export function setTenantConfig(cfg: TenantConfig): void {
  current = cfg
}

/** Base64 JSON payload for the X-Notion-Config header; '' when unset. */
export function getTenantHeader(): string {
  return current ? btoa(JSON.stringify(current)) : ''
}

/**
 * Build a TenantConfig from local-dev env vars (VITE_NOTION_*), so the
 * evenhub-simulator doesn't require re-entering settings each run. Only
 * resolves during `vite dev` (import.meta.env.DEV) — never in a built app.
 */
export function getDevEnvConfig(): TenantConfig | null {
  if (!import.meta.env.DEV) return null
  const token = import.meta.env.VITE_NOTION_TOKEN
  const tasksDb = import.meta.env.VITE_NOTION_TASKS_DB
  const notesDb = import.meta.env.VITE_NOTION_NOTES_DB
  const projectsDb = import.meta.env.VITE_NOTION_PROJECTS_DB
  const tagsDb = import.meta.env.VITE_NOTION_TAGS_DB
  if (!token || !tasksDb || !notesDb || !projectsDb || !tagsDb) return null
  return {
    token,
    tasksDb,
    notesDb,
    projectsDb,
    tagsDb,
    excludeProjectId: import.meta.env.VITE_NOTION_EXCLUDE_PROJECT_ID || undefined,
  }
}
