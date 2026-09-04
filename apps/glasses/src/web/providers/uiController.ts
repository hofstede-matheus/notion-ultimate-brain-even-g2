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
  /** Real glasses link state from bridge.onDeviceStatusChanged; null until the first push. */
  deviceConnected: boolean | null;
}

let state: UiState = {
  status: 'Connecting...',
  connect: { visible: true, disabled: false, label: 'Connect' },
  connected: false,
  settingsOpen: false,
  settingsPrefill: null,
  settingsCancellable: false,
  navDirection: 'forward',
  deviceConnected: null,
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

/** Invoked by boot.ts's bridge.onDeviceStatusChanged subscription. */
export function setDeviceConnected(connected: boolean): void {
  setState({ deviceConnected: connected });
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

let pendingResolve: ((saved: boolean) => void) | null = null;
let pendingPromise: Promise<boolean> | null = null;

function openSettings(prefill: TenantConfig | null, cancellable: boolean): void {
  setState({
    settingsOpen: true,
    settingsPrefill: prefill,
    settingsCancellable: cancellable,
    navDirection: 'forward',
  });
}

function closeSettings(saved: boolean): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  pendingPromise = null;
  setState({ settingsOpen: false, navDirection: 'back' });
  resolve?.(saved);
}

/**
 * Invoked by the React settings form once its configuration is already in effect — the form
 * commits directly (setTenantConfig, then this call; see SettingsForm.tsx's handleSubmit and
 * ./submit.ts), so by the time this runs there is nothing left to lose. This only closes the
 * form and reports success to whoever is awaiting promptForConfig.
 */
export function settingsSaved(): void {
  closeSettings(true);
}

/** Invoked by the React back button — dismiss settings without saving. */
export function cancelSettings(): void {
  closeSettings(false);
}

/**
 * Reveal the settings form pre-filled with `prefill`. Resolves `true` once the user saves,
 * `false` if they back out instead. Invoked by ../boot.ts's `reconfigure()`. When `cancellable`,
 * a back button is shown.
 */
export function promptForConfig(
  prefill?: TenantConfig | null,
  cancellable = false,
): Promise<boolean> {
  openSettings(prefill ?? null, cancellable);
  if (pendingPromise) return pendingPromise;
  pendingPromise = new Promise((resolve) => {
    pendingResolve = resolve;
  });
  return pendingPromise;
}
