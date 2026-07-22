/**
 * Wire shape of a device's Notion tenant config — persisted client-side by
 * the glasses app (tenant-config.ts) and sent as the base64 X-Notion-Config
 * header, decoded server-side by tenant.ts's parseTenant().
 */
export interface TenantConfig {
  token: string;
  tasksDb: string;
  notesDb: string;
  projectsDb: string;
  tagsDb: string;
  // IANA timezone name of the device (e.g. 'America/Sao_Paulo'), injected at
  // header-build time by the glasses app. The server resolves relative date
  // keywords ("today"/"tomorrow") against this zone so they match the user's
  // local calendar day rather than UTC. Optional: absent falls back to UTC.
  timeZone?: string;
}
