import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { TenantConfig } from '@notion-ub/contracts';
import {
  disableConnect,
  hideConnect,
  onConnectClick,
  onSettingsClick,
  promptForConfig,
  setDeviceConnected,
  setStatus,
  showRetry,
} from '@web/providers/uiController';
import { loadStoredConfig } from '@web/services/config';
import { BOOT_SPLASH_MIN_MS, BRIDGE_WAIT_TIMEOUT_MS } from './glasses/constants';
import { attachGlassesListeners, showGlassesScreen } from './glasses/events';
import { StartupRejectedError } from './glasses/render';
import { loadPreviousSession, startPersisting } from './logging/persist';
import { trace } from './logging/trace';
import { loadQueue, startDraining } from './offline-queue';
import { setBridge, state } from './state';
import { getDevEnvConfig, getTenantConfig, setTenantConfig } from './tenant-config';
import { refreshVoiceStatus } from './voice-runtime';

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, ensure a Notion tenant config
// is set (prompting on first run), start the glasses runtime, and resolve the
// configured speech backend in the background
// ---------------------------------------------------------------------------

/**
 * Prompts for config (pre-filled with `prefill`) and waits for it to be saved or backed out of.
 * The form commits the configuration itself — setTenantConfig, then a durable write, both before
 * resolving promptForConfig (see SettingsForm.tsx's handleSubmit and
 * ./web/screens/SettingsForm/submit.ts) — so there is nothing left for this function to persist.
 * When `prefill` is present the form is cancellable (a back button appears); backing out leaves
 * the existing config untouched. Exported for config-health.ts's reportApiFailure, which reopens
 * Settings the same way the gear icon does when a saved database stops working.
 */
export async function reconfigure(prefill?: TenantConfig | null): Promise<boolean> {
  const saved = await promptForConfig(prefill, prefill != null);
  trace.info('BOOT', saved ? 'tenant config saved' : 'settings cancelled, keeping existing config');
  return saved;
}

async function holdSplash(splashAt: number): Promise<void> {
  const remaining = BOOT_SPLASH_MIN_MS - (Date.now() - splashAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

async function waitForBridge() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      waitForEvenAppBridge(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Timed out waiting for Even Hub bridge')),
          BRIDGE_WAIT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
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
      const bridge = await waitForBridge();
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

      // Only now: the queue's storage key is tenant-scoped and sending needs
      // the tenant header. loadQueue() must land before startDraining(), the
      // same ordering logging/persist.ts documents for its own pair.
      void loadQueue().finally(startDraining);

      await holdSplash(splashAt);
      await showGlassesScreen('menu');
      trace.info('BOOT', 'glasses started');

      setStatus('Connected! Use your glasses.');
      hideConnect();

      // Off the critical path — the menu is already on screen.
      void refreshVoiceStatus();
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
        if (state.startupRendered) void showGlassesScreen('boot-error');
      }
      showRetry();
    }
  }

  // Auto-connect on load
  void connect();

  // Manual retry button
  onConnectClick(() => void connect());

  // Settings button — always available, independent of connection state
  onSettingsClick(
    () =>
      void (async () => {
        if (!(await reconfigure(getTenantConfig()))) return;
        state.lists = {};
        state.listPages = {};
        state.listStatus = {};
        state.configSuspect = false;
        if (state.startupRendered) await showGlassesScreen('menu');
      })(),
  );
}
