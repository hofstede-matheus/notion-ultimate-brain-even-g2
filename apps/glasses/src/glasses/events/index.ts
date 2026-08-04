import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { flush as flushLog } from '../../logging/persist';
import { trace } from '../../logging/trace';
import { getBridge, state } from '../../state';
import * as stt from '../../stt';
import { createGlassCtx } from '../glass-ctx';
import { renderFull, resetRenderSession } from '../render';
import { router } from '../router';
import { eventTypeName, isScrollThrottled, resolveEventType, toGlassAction } from './resolve';

const ctx = createGlassCtx();

/** Unsubscribe for the current onEvenHubEvent listener — see startGlasses(). */
let unsubscribeHub: (() => void) | null = null;
/** Guards against attaching a second pagehide listener across repeated startGlasses() calls. */
let pagehideAttached = false;

// ---------------------------------------------------------------------------
// Lifecycle events — pushed via sysEvent, handled before toGlassAction (which
// has no action mapping for them and would just log a warning).
// ---------------------------------------------------------------------------

function handleForegroundEnter(): void {
  trace.info('EVT', 'foreground enter — redrawing');
  // A background/foreground cycle can't be assumed to leave the firmware's
  // container state (in particular the calendar's image containers) intact.
  resetRenderSession();
  void renderFull();
}

function handleForegroundExit(): void {
  trace.info('EVT', 'foreground exit — flushing log');
  void flushLog();
}

/**
 * Stops glasses hardware and unsubscribes the event listener. Safe to call
 * unconditionally — `stt.stopListening()` and `audioControl(false)` are both
 * no-ops when nothing is active. `stopListening()` runs first so a live
 * recording's `onStop` callback (which itself closes the mic — see
 * modules/tasks/voice.ts) fires under the still-current session, the same
 * ordering `cancelRecordingAndGoBack` already relies on.
 */
async function teardownGlasses(reason: string): Promise<void> {
  trace.info('EVT', `teardown (${reason})`);
  stt.stopListening();
  const b = getBridge();
  if (b) await b.audioControl(false);
  unsubscribeHub?.();
  unsubscribeHub = null;
}

// ---------------------------------------------------------------------------
// Main event dispatcher
// ---------------------------------------------------------------------------

export function onEvenHubEvent(event: EvenHubEvent): void {
  // Route PCM audio frames to Vosk while a session is active.
  if (event.audioEvent && event.audioEvent.audioPcm != null && stt.isListening()) {
    stt.feedAudio(event.audioEvent.audioPcm);
    return;
  }

  const eventType = resolveEventType(event);
  if (eventType === undefined) return;

  trace.info('EVT', eventTypeName(eventType), {
    screen: state.screen,
    idx: event.listEvent?.currentSelectItemIndex,
    name: event.listEvent?.currentSelectItemName,
  });

  switch (eventType) {
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      handleForegroundEnter();
      return;
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      handleForegroundExit();
      return;
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
    case OsEventTypeList.SYSTEM_EXIT_EVENT:
      void teardownGlasses(eventTypeName(eventType));
      return;
    default:
      break;
  }

  // Throttle scroll events
  if (
    eventType === OsEventTypeList.SCROLL_TOP_EVENT ||
    eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    if (isScrollThrottled()) return;
  }

  const action = toGlassAction(event, eventType);
  if (!action) return;

  router.onGlassAction(action, state, ctx);
}

/**
 * Start the glasses runtime: wires the SDK event listener and renders the
 * initial menu screen. Call once after the bridge is connected. Idempotent
 * against a second call (e.g. the retry button after a failed connect) —
 * re-subscribing without unsubscribing the previous listener first would
 * double-fire every gesture.
 */
export async function startGlasses(): Promise<void> {
  const b = getBridge();
  if (!b) return;

  unsubscribeHub?.();
  unsubscribeHub = b.onEvenHubEvent(onEvenHubEvent);

  // Covers the WebView-killed case no SDK lifecycle event can reach. Guarded:
  // this module is unit-tested under vitest's node environment, which has no
  // `window` — same guard logging/persist.ts uses for its own pagehide hook.
  if (typeof window !== 'undefined' && !pagehideAttached) {
    pagehideAttached = true;
    window.addEventListener('pagehide', () => {
      void teardownGlasses('pagehide');
    });
  }

  state.screen = 'menu';
  await renderFull();
}
