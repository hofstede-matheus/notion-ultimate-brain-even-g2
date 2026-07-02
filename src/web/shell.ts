/**
 * DOM wiring for the companion-app webview shell (status text + connect
 * button). Kept separate from the glasses display code under ../glasses/.
 */

const statusEl = document.getElementById('status')
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null

export function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg
}

export function disableConnect(): void {
  if (connectBtn) connectBtn.disabled = true
}

export function hideConnect(): void {
  if (connectBtn) connectBtn.style.display = 'none'
}

export function showRetry(): void {
  if (connectBtn) {
    connectBtn.disabled = false
    connectBtn.textContent = 'Retry'
  }
}

export function onConnectClick(handler: () => void): void {
  connectBtn?.addEventListener('click', handler)
}
