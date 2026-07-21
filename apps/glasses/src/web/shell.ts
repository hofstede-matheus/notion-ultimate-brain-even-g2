/**
 * boot.ts's connection-status shell API. Internals now write to ./store
 * (read by the React webview) instead of the DOM directly — see ../boot.ts
 * for the calling contract this preserves.
 */

import * as store from './store';

export function setStatus(msg: string): void {
  store.setStatus(msg);
}

export function disableConnect(): void {
  store.disableConnect();
}

export function hideConnect(): void {
  store.hideConnect();
}

export function showRetry(): void {
  store.showRetry();
}

export function onConnectClick(handler: () => void): void {
  store.onConnectClick(handler);
}
