/**
 * Reactive UI store bridging boot.ts's imperative shell/settings API (see
 * ./shell and ./settings) onto the React webview (see ./components/App).
 * boot.ts keeps driving the app through setStatus/showRetry/promptForConfig/
 * etc. — this store is just where those calls now land instead of the DOM.
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
// shell.ts — connection status + connect/retry button
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
// settings.ts — settings form visibility + submit resolution
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

export function openSettings(prefill: TenantConfig | null): void {
  setState({ settingsOpen: true, settingsPrefill: prefill });
}

export function setPendingResolve(resolve: (cfg: TenantConfig) => void): void {
  pendingResolve = resolve;
}

/** Invoked by the React settings form on valid submit. */
export function resolveSettings(cfg: TenantConfig): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  setState({ settingsOpen: false });
  resolve?.(cfg);
}
