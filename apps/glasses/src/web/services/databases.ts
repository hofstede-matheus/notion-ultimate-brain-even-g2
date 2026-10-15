/**
 * Lists the Notion databases an integration token can see — for the settings
 * form's database picker. Runs before any DB id is known (that's the whole
 * point), so it can't go through ../../api.ts's request() (which reads the
 * tenant config's X-Notion-Config header); it hits the server's token-only
 * /api/databases route directly with X-Notion-Token instead.
 */

import type { NotionDatabaseSummary } from '@notion-ub/contracts';
import { fetchWithRetry } from '../../http/client';
import { ApiError } from '../../http/errors';
import { registerSecret } from '../../logging/redact';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

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

  try {
    const { databases } = await fetchWithRetry<{ databases: NotionDatabaseSummary[] }>(
      `${API_BASE}/api/databases`,
      { headers: { 'X-Notion-Token': token } },
      { label: '/api/databases', previewBytes: 200 },
    );
    return databases;
  } catch (e) {
    // 401 isn't in retry.ts's RETRYABLE_STATUSES, so it always fails on the first attempt —
    // essential, since SettingsForm.tsx calls this on a debounced keystroke.
    if (e instanceof ApiError && e.status === 401) throw new InvalidTokenError();
    throw e;
  }
}
