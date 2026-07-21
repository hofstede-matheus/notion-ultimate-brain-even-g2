/** Persistence for the Notion tenant-config settings form. Best-effort, same as cache.ts. */

import type { TenantConfig } from '@notion-ub/contracts';
import { getBridge } from '../../state';

const CONFIG_KEY = 'notionultimatebrain:config';

export async function loadStoredConfig(): Promise<TenantConfig | null> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(CONFIG_KEY) : window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TenantConfig;
  } catch {
    return null;
  }
}

export async function saveStoredConfig(cfg: TenantConfig): Promise<void> {
  const raw = JSON.stringify(cfg);
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(CONFIG_KEY, raw);
    else window.localStorage.setItem(CONFIG_KEY, raw);
  } catch {
    // ignore
  }
}
