/**
 * Wire shape of a device's Notion tenant config — persisted client-side by
 * the glasses app (tenant-config.ts) and sent as the base64 X-Notion-Config
 * header, decoded server-side by tenant.ts's parseTenant().
 */
export interface TenantConfig {
  token: string
  tasksDb: string
  notesDb: string
  projectsDb: string
  tagsDb: string
  excludeProjectId?: string
}
