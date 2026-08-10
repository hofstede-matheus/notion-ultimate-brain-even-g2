import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { TenantConfig } from '@notion-ub/contracts';
import {
  disableConnect,
  hideConnect,
  onConnectClick,
  onSettingsClick,
  promptForConfig,
  SettingsCancelledError,
  setDeviceConnected,
  setStatus,
  showRetry,
} from '@web/providers/uiController';
import { loadStoredConfig, saveStoredConfig } from '@web/services/config';
import { BOOT_SPLASH_MIN_MS, VOSK_MODEL_URL } from './glasses/constants';
import { attachGlassesListeners, showGlassesScreen } from './glasses/events';
import { StartupRejectedError } from './glasses/render';
import { loadPreviousSession, startPersisting } from './logging/persist';
import { trace } from './logging/trace';
import { setBridge } from './state';
import { preloadVoskModel } from './stt';
import { getDevEnvConfig, getTenantConfig, setTenantConfig } from './tenant-config';

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, ensure a Notion tenant config
// is set (prompting on first run), start the glasses runtime, warm the
// voice model in the background
// ---------------------------------------------------------------------------

/**
 * Prompts for config (pre-filled with `prefill`), persists it, and applies it.
 * When `prefill` is present the form is cancellable (a back button appears);
 * backing out keeps the existing config untouched.
 */
async function reconfigure(prefill?: TenantConfig | null): Promise<void> {
  try {
    const cfg = await promptForConfig(prefill, prefill != null);
    await saveStoredConfig(cfg);
    setTenantConfig(cfg);
    trace.info('BOOT', 'tenant config saved');
  } catch (err) {
    if (err instanceof SettingsCancelledError) {
      trace.info('BOOT', 'settings cancelled, keeping existing config');
      return;
    }
    throw err;
  }
}

async function holdSplash(splashAt: number): Promise<void> {
  const remaining = BOOT_SPLASH_MIN_MS - (Date.now() - splashAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

export async function boot(): Promise<void> {
  trace.info('BOOT', 'session start', {
    app: __APP_VERSION__,
    apiBase: import.meta.env.VITE_API_BASE || '(same-origin)',
    ua: navigator.userAgent,
  });
  // Fire-and-forget: previous-session lines get prepended once loaded, but
  // nothing else in boot() should wait on the storage bridge for this.
  void loadPreviousSession().finally(startPersisting);

  let deviceStatusUnsub: (() => void) | null = null;

  async function connect(): Promise<void> {
    trace.info('BOOT', 'connect start');
    setStatus('Waiting for Even Hub bridge...');
    disableConnect();

    try {
      const bridge = await waitForEvenAppBridge();
      setBridge(bridge);
      trace.info('BOOT', 'bridge acquired');
      attachGlassesListeners();
      await showGlassesScreen('booting');
      const splashAt = Date.now();

      // Real glasses link state, independent of whether startup rendering
      // succeeded — a second connect() (via the retry button) must not stack
      // a duplicate listener.
      deviceStatusUnsub?.();
      deviceStatusUnsub = bridge.onDeviceStatusChanged((status) => {
        trace.info('DEV', `device status = ${status.connectType}`, {
          connected: status.isConnected(),
        });
        // isConnected() is false for 4 different states, two of them transient
        // (None = not yet initialized, Connecting = mid-handshake) rather than
        // evidence of an actual problem. The glasses are commonly already
        // connected before this listener attaches — onDeviceStatusChanged only
        // pushes on a *change*, so a stale None/Connecting snapshot can be the
        // only push we ever get, and treating it as "disconnected" would show
        // a false warning that never clears. Only a genuine negative signal
        // (Disconnected/ConnectionFailed) sets deviceConnected to false; a
        // transient one leaves it as-is rather than overriding a good state.
        if (status.isConnected()) {
          setDeviceConnected(true);
        } else if (status.isDisconnected() || status.isConnectionFailed()) {
          setDeviceConnected(false);
        }
      });

      // Fires exactly once per app instance — must be registered right after
      // the bridge is ready or the event is missed. Log-only: deep-linking
      // 'glassesMenu' straight to a screen is a product decision, not a fix.
      bridge.onLaunchSource((src) => trace.info('BOOT', `launch source = ${src}`));

      let cfg = await loadStoredConfig();
      let cfgSource: 'stored' | 'env' | 'prompted' = 'stored';
      if (!cfg) {
        cfg = getDevEnvConfig();
        cfgSource = 'env';
      }
      if (!cfg) {
        await holdSplash(splashAt);
        await showGlassesScreen('setup-needed');
        setStatus('Enter your Notion settings to continue.');
        cfgSource = 'prompted';
        await reconfigure();
      } else {
        setTenantConfig(cfg);
      }
      trace.info('BOOT', `config source = ${cfgSource}`);

      await holdSplash(splashAt);
      await showGlassesScreen('menu');
      trace.info('BOOT', 'glasses started');

      setStatus('Connected! Use your glasses.');
      hideConnect();

      // Warm the Vosk model in the background — off the critical path.
      // By the time the user navigates to Add Task the model will be ready.
      trace.info('BOOT', 'vosk preload started');
      preloadVoskModel(VOSK_MODEL_URL);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      trace.error('BOOT', `connect failed: ${msg}`);
      if (err instanceof StartupRejectedError) {
        // state.startupRendered is still false (render/index.ts never set it) — retrying
        // re-attempts createStartUpPageContainer, which the SDK documents as one-shot, so
        // a retry may also be refused. That refusal will now be logged, not silent.
        setStatus('Glasses display setup failed — check the glasses are connected, then retry.');
      } else {
        setStatus('Connection failed. Tap to retry.');
      }
      showRetry();
    }
  }

  // Auto-connect on load
  void connect();

  // Manual retry button
  onConnectClick(() => void connect());

  // Settings button — always available, independent of connection state
  onSettingsClick(() => void reconfigure(getTenantConfig()));
}
