import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { setBridge } from './state'
import { startGlasses } from './glasses/runtime'
import { VOSK_MODEL_URL } from './glasses/constants'
import { preloadVoskModel } from './stt'
import { setStatus, disableConnect, hideConnect, showRetry, onConnectClick } from './web/shell'
import { loadStoredConfig, saveStoredConfig, promptForConfig, onSettingsClick } from './web/settings'
import { getTenantConfig, setTenantConfig, getDevEnvConfig } from './tenant-config'

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, ensure a Notion tenant config
// is set (prompting on first run), start the glasses runtime, warm the
// voice model in the background
// ---------------------------------------------------------------------------

export async function boot(): Promise<void> {
  async function connect(): Promise<void> {
    setStatus('Waiting for Even Hub bridge...')
    disableConnect()

    try {
      const bridge = await waitForEvenAppBridge()
      setBridge(bridge)

      let cfg = await loadStoredConfig()
      if (!cfg) cfg = getDevEnvConfig()
      if (!cfg) {
        setStatus('Enter your Notion settings to continue.')
        cfg = await promptForConfig()
        await saveStoredConfig(cfg)
      }
      setTenantConfig(cfg)

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

  // Settings button — always available, independent of connection state
  onSettingsClick(() => {
    void (async () => {
      const cfg = await promptForConfig(getTenantConfig())
      await saveStoredConfig(cfg)
      setTenantConfig(cfg)
    })()
  })
}
