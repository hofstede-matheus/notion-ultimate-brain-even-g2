import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { setBridge } from './state'
import { showMenu } from './renderer'
import { onEvenHubEvent } from './events'
import { preloadVoskModel } from './stt'

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------

export async function initApp(): Promise<void> {
  const statusEl = document.getElementById('status')
  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null

  function setStatus(msg: string) {
    if (statusEl) statusEl.textContent = msg
  }

  async function connect() {
    setStatus('Waiting for Even Hub bridge...')
    if (connectBtn) connectBtn.disabled = true

    try {
      const bridge = await waitForEvenAppBridge()
      setBridge(bridge)

      // Wire event listener
      bridge.onEvenHubEvent(onEvenHubEvent)

      setStatus('Connected! Use your glasses.')
      if (connectBtn) connectBtn.style.display = 'none'

      // Render initial menu screen
      await showMenu()

      // Warm the Vosk model in the background — off the critical path, same as EvenChess.
      // By the time the user navigates to Add Task the model will be ready.
      preloadVoskModel('/vosk/model.tar.gz')
    } catch (err) {
      console.error('[notion-ultimate-brain] bridge init failed', err)
      setStatus('Connection failed. Tap to retry.')
      if (connectBtn) {
        connectBtn.disabled = false
        connectBtn.textContent = 'Retry'
      }
    }
  }

  // Auto-connect on load
  void connect()

  // Manual retry button
  if (connectBtn) {
    connectBtn.addEventListener('click', () => void connect())
  }
}