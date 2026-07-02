import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { setBridge } from './state'
import { startGlasses } from './glasses/runtime'
import { VOSK_MODEL_URL } from './glasses/constants'
import { preloadVoskModel } from './stt'
import { setStatus, disableConnect, hideConnect, showRetry, onConnectClick } from './web/shell'

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, start the glasses runtime,
// warm the voice model in the background
// ---------------------------------------------------------------------------

export async function boot(): Promise<void> {
  async function connect(): Promise<void> {
    setStatus('Waiting for Even Hub bridge...')
    disableConnect()

    try {
      const bridge = await waitForEvenAppBridge()
      setBridge(bridge)

      // Wire event listener + render the initial menu screen
      await startGlasses()

      setStatus('Connected! Use your glasses.')
      hideConnect()

      // Warm the Vosk model in the background — off the critical path, same as EvenChess.
      // By the time the user navigates to Add Task the model will be ready.
      preloadVoskModel(VOSK_MODEL_URL)
    } catch {
      setStatus('Connection failed. Tap to retry.')
      showRetry()
    }
  }

  // Auto-connect on load
  void connect()

  // Manual retry button
  onConnectClick(() => void connect())
}
