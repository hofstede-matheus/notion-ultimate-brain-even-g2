import type { TenantConfig } from '@notion-ub/contracts';

export interface TenantDb {
  tasks: string;
  notes: string;
  projects: string;
  tags: string;
}

export interface Tenant {
  token: string;
  db: TenantDb;
  // IANA timezone of the requesting device; used to resolve relative date
  // keywords against the user's local calendar day. Absent → UTC.
  timeZone?: string;
}

// Wire shape carried in the X-Notion-Config header: a base64 JSON blob,
// field-for-field the shared TenantConfig — but every value starts out
// unknown until isNonEmptyString below validates it.
type TenantHeaderPayload = { [K in keyof TenantConfig]?: unknown };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Decode and validate the X-Notion-Config header into a Tenant. Returns null
 * on any missing/malformed field rather than throwing, so callers can
 * uniformly respond 401.
 */
export function parseTenant(headerValue: string | undefined | string[]): Tenant | null {
  if (typeof headerValue !== 'string' || !headerValue) return null;

  let payload: TenantHeaderPayload;
  try {
    const raw = Buffer.from(headerValue, 'base64').toString('utf-8');
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const { token, tasksDb, notesDb, projectsDb, tagsDb, timeZone } = payload;
  if (
    !isNonEmptyString(token) ||
    !isNonEmptyString(tasksDb) ||
    !isNonEmptyString(notesDb) ||
    !isNonEmptyString(projectsDb) ||
    !isNonEmptyString(tagsDb)
  ) {
    return null;
  }

  return {
    token,
    db: {
      tasks: tasksDb,
      notes: notesDb,
      projects: projectsDb,
      tags: tagsDb,
    },
    ...(isNonEmptyString(timeZone) ? { timeZone } : {}),
  };
}
