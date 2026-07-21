/**
 * Persistence + boot.ts contract for the Notion tenant-config settings form.
 * The form itself now lives in ./components/SettingsForm (React); this
 * module just opens/closes it via ./store and resolves the returned Promise
 * on submit — the same "resolve once the user submits a valid config"
 * contract ../boot.ts already relies on.
 */

import type { TenantConfig } from '@notion-ub/contracts';
import { getBridge } from '../state';
import * as store from './store';

const CONFIG_KEY = 'notionultimatebrain:config';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

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

/** Failures are swallowed — persistence is best-effort, same as cache.ts. */
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

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

/**
 * Reveal the settings form pre-filled with `prefill`, and resolve once the
 * user submits a valid config (token + all 4 DB fields non-empty).
 */
export function promptForConfig(prefill?: TenantConfig | null): Promise<TenantConfig> {
  store.openSettings(prefill ?? null);
  return new Promise((resolve) => {
    store.setPendingResolve(resolve);
  });
}

export function onSettingsClick(handler: () => void): void {
  store.onSettingsClick(handler);
}
