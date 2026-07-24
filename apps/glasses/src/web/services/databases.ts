/**
 * Lists the Notion databases an integration token can see — for the settings
 * form's database picker. Runs before any DB id is known (that's the whole
 * point), so it can't go through ../../api.ts's request() (which reads the
 * tenant config's X-Notion-Config header); it hits the server's token-only
 * /api/databases route directly with X-Notion-Token instead.
 */

import type { NotionDatabaseSummary } from '@notion-ub/contracts';
import { registerSecret } from '../../logging/redact';
import { trace } from '../../logging/trace';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** Bytes of a non-2xx response body captured in the trace log before throwing. */
const ERROR_BODY_PREVIEW_BYTES = 200;

export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid Notion token');
    this.name = 'InvalidTokenError';
  }
}

export async function fetchDatabases(token: string): Promise<NotionDatabaseSummary[]> {
  // Registered before the request so the token is scrubbed from any trace
  // line even though it isn't in the tenant config yet — setTenantConfig()
  // (../../tenant-config.ts) hasn't run at this point in the settings flow.
  registerSecret(token);

  const res = await fetch(`${API_BASE}/api/databases`, {
    headers: { 'X-Notion-Token': token },
  });

  if (!res.ok) {
    const body = await res
      .clone()
      .text()
      .then((t) => t.slice(0, ERROR_BODY_PREVIEW_BYTES))
      .catch(() => '<unreadable body>');
    trace.error('API', `/api/databases ${res.status} ${res.statusText}`, { body });
    if (res.status === 401) throw new InvalidTokenError();
    throw new Error(`Request failed with status ${res.status}`);
  }

  const { databases } = (await res.json()) as { databases: NotionDatabaseSummary[] };
  trace.info('API', '/api/databases ok', { count: databases.length });
  return databases;
}
