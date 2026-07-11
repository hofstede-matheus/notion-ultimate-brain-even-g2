/**
 * In-memory holder for the current device's Notion tenant config (token +
 * database IDs), and the header encoding sent with every /api/* request.
 * Persistence across app restarts lives in web/settings.ts.
 */

export interface TenantConfig {
  token: string
  tasksDb: string
  notesDb: string
  projectsDb: string
  tagsDb: string
  excludeProjectId?: string
}

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
