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

/** Direction of the last page navigation — drives the push/pop slide. */
export type NavDirection = 'forward' | 'back';

export interface UiState {
  status: string;
  connect: ConnectState;
  connected: boolean;
  settingsOpen: boolean;
  settingsPrefill: TenantConfig | null;
  /** Whether the settings page can be dismissed with a back button. */
  settingsCancellable: boolean;
  /** Which way the current page transition should animate. */
  navDirection: NavDirection;
}

let state: UiState = {
  status: 'Connecting...',
  connect: { visible: true, disabled: false, label: 'Connect' },
  connected: false,
  settingsOpen: false,
  settingsPrefill: null,
  settingsCancellable: false,
  navDirection: 'forward',
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

/** Rejection raised when the user backs out of settings without saving. */
export class SettingsCancelledError extends Error {
  constructor() {
    super('Settings cancelled');
    this.name = 'SettingsCancelledError';
  }
}

let pendingResolve: ((cfg: TenantConfig) => void) | null = null;
let pendingReject: ((reason: SettingsCancelledError) => void) | null = null;

function openSettings(prefill: TenantConfig | null, cancellable: boolean): void {
  setState({
    settingsOpen: true,
    settingsPrefill: prefill,
    settingsCancellable: cancellable,
    navDirection: 'forward',
  });
}

/** Invoked by the React settings form on valid submit. */
export function resolveSettings(cfg: TenantConfig): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  pendingReject = null;
  setState({ settingsOpen: false, navDirection: 'back' });
  resolve?.(cfg);
}

/** Invoked by the React back button — dismiss settings without saving. */
export function cancelSettings(): void {
  const reject = pendingReject;
  pendingResolve = null;
  pendingReject = null;
  setState({ settingsOpen: false, navDirection: 'back' });
  reject?.(new SettingsCancelledError());
}

/**
 * Reveal the settings form pre-filled with `prefill`, and resolve once the
 * user submits a valid config (token + all 4 DB fields non-empty). Invoked
 * by ../boot.ts's `reconfigure()`. When `cancellable`, a back button is shown
 * and backing out rejects with SettingsCancelledError.
 */
export function promptForConfig(
  prefill?: TenantConfig | null,
  cancellable = false,
): Promise<TenantConfig> {
  openSettings(prefill ?? null, cancellable);
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
}
