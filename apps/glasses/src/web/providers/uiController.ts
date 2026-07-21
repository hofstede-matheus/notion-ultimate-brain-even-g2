/**
 * Imperative bridge boot.ts drives the UI through (status text, connect
 * button, settings dialog) — a module-level external store so boot.ts can
 * call these functions before or after React mounts. UiStateProvider
 * subscribes to this store via useSyncExternalStore and republishes it
 * through Context; see ./UiStateProvider and ../hooks/useUiState.
 */

import type { TenantConfig } from '@notion-ub/contracts';

interface ConnectState {
  visible: boolean;
  disabled: boolean;
  label: string;
}

export interface UiState {
  status: string;
  connect: ConnectState;
  connected: boolean;
  settingsOpen: boolean;
  settingsPrefill: TenantConfig | null;
}

let state: UiState = {
  status: 'Connecting...',
  connect: { visible: true, disabled: false, label: 'Connect' },
  connected: false,
  settingsOpen: false,
  settingsPrefill: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function getState(): UiState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Connection status + connect/retry button (boot.ts's shell contract)
// ---------------------------------------------------------------------------

export function setStatus(msg: string): void {
  setState({ status: msg });
}

export function disableConnect(): void {
  setState({ connect: { ...state.connect, disabled: true } });
}

export function hideConnect(): void {
  setState({ connect: { ...state.connect, visible: false }, connected: true });
}

export function showRetry(): void {
  setState({ connect: { visible: true, disabled: false, label: 'Retry' } });
}

let connectHandler: (() => void) | null = null;

export function onConnectClick(handler: () => void): void {
  connectHandler = handler;
}

/** Invoked by the React Connect/Retry button. */
export function triggerConnect(): void {
  connectHandler?.();
}

// ---------------------------------------------------------------------------
// Settings form visibility + submit resolution (boot.ts's settings contract)
// ---------------------------------------------------------------------------

let settingsHandler: (() => void) | null = null;

export function onSettingsClick(handler: () => void): void {
  settingsHandler = handler;
}

/** Invoked by the React settings-gear button. */
export function triggerSettings(): void {
  settingsHandler?.();
}

let pendingResolve: ((cfg: TenantConfig) => void) | null = null;

function openSettings(prefill: TenantConfig | null): void {
  setState({ settingsOpen: true, settingsPrefill: prefill });
}

function setPendingResolve(resolve: (cfg: TenantConfig) => void): void {
  pendingResolve = resolve;
}

/** Invoked by the React settings form on valid submit. */
export function resolveSettings(cfg: TenantConfig): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  setState({ settingsOpen: false });
  resolve?.(cfg);
}

/**
 * Reveal the settings form pre-filled with `prefill`, and resolve once the
 * user submits a valid config (token + all 4 DB fields non-empty). Invoked
 * by ../boot.ts's `reconfigure()`.
 */
export function promptForConfig(prefill?: TenantConfig | null): Promise<TenantConfig> {
  openSettings(prefill ?? null);
  return new Promise((resolve) => {
    setPendingResolve(resolve);
  });
}
