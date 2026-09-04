import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { flush as flushLog } from '../../logging/persist';
import { trace } from '../../logging/trace';
import { drainQueue } from '../../offline-queue';
import { getBridge, type ScreenName, state } from '../../state';
import * as stt from '../../stt';
import { CONTEXT_MENU_OVERLAY_MS, HOLD_ACTION_DELAY_MS } from '../constants';
import { createGlassCtx } from '../glass-ctx';
import { renderFull, resetRenderSession } from '../render';
import { router } from '../router';
import type { AppGlassAction } from '../types';
import { eventTypeName, isScrollThrottled, resolveEventType, toGlassAction } from './resolve';

const ctx = createGlassCtx();

/** Unsubscribe for the current onEvenHubEvent listener — see attachGlassesListeners(). */
let unsubscribeHub: (() => void) | null = null;
/** Guards against attaching a second pagehide listener across repeated attachGlassesListeners() calls. */
let pagehideAttached = false;

// ---------------------------------------------------------------------------
// Contextual-menu overlay guard — a menu selection is bracketed by
// FOREGROUND_ENTER_EVENT -> menuItemClickEvent -> FOREGROUND_EXIT_EVENT (see
// docs/contextual-menu.md in even-g2-context); the trailing exit means the
// OS overlay closed, not that the app backgrounded. Without this, every menu
// tap would also trigger handleForegroundEnter's full
// resetRenderSession()+renderFull() and handleForegroundExit's log flush.
// ---------------------------------------------------------------------------

let contextMenuOverlayOpen = false;
let overlayGuardTimeout: ReturnType<typeof setTimeout> | null = null;

/** Arms the guard on LONG_PRESS_EVENT (the gesture that raises the overlay). Bounded by
 * CONTEXT_MENU_OVERLAY_MS so an overlay dismissed with no selection can never wedge real
 * foreground handling — see that constant's doc comment for the trade-off this accepts. */
function armContextMenuOverlay(): void {
  contextMenuOverlayOpen = true;
  if (overlayGuardTimeout !== null) clearTimeout(overlayGuardTimeout);
  overlayGuardTimeout = setTimeout(() => {
    overlayGuardTimeout = null;
    contextMenuOverlayOpen = false;
  }, CONTEXT_MENU_OVERLAY_MS);
}

function clearContextMenuOverlay(): void {
  contextMenuOverlayOpen = false;
  if (overlayGuardTimeout !== null) {
    clearTimeout(overlayGuardTimeout);
    overlayGuardTimeout = null;
  }
}

// ---------------------------------------------------------------------------
// Hold vs tap-and-hold — both arrive as the same LONG_PRESS_EVENT, so the
// hold's action is deferred and cancelled if the OS overlay turns up inside
// HOLD_ACTION_DELAY_MS (see that constant for the full reasoning).
// ---------------------------------------------------------------------------

let pendingHoldTimeout: ReturnType<typeof setTimeout> | null = null;

function schedulePendingHold(action: AppGlassAction): void {
  cancelPendingHold();
  pendingHoldTimeout = setTimeout(() => {
    pendingHoldTimeout = null;
    trace.debug('EVT', 'hold settled — no overlay, running the hold action');
    router.onGlassAction(action, state, ctx);
  }, HOLD_ACTION_DELAY_MS);
}

/** Called the moment the overlay announces itself: the gesture was a tap-and-hold, not a hold. */
function cancelPendingHold(reason?: string): void {
  if (pendingHoldTimeout === null) return;
  clearTimeout(pendingHoldTimeout);
  pendingHoldTimeout = null;
  if (reason) trace.debug('EVT', `hold action cancelled — ${reason}`);
}

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
  // The WebView has no network while backgrounded, so coming back is the
  // closest thing to a reconnect event this platform exposes.
  void drainQueue('foreground enter');
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

  // menuItemClickEvent (SDK 0.0.14+) is a TOP-LEVEL field, never an
  // OsEventTypeList ordinal — resolveEventType only reads
  // listEvent/textEvent/sysEvent and would drop this through the
  // "unrecognised event dropped" warning, so it's handled first.
  const menuItemId = event.menuItemClickEvent?.itemID;
  if (menuItemId !== undefined) {
    trace.info('EVT', 'menuItemClickEvent', { screen: state.screen, itemID: menuItemId });
    // Belt and braces: the overlay's FOREGROUND_ENTER should already have cancelled this,
    // but a selection is proof on its own that the gesture was a tap-and-hold.
    cancelPendingHold('menu item selected');
    router.onMenuItemClick(menuItemId, state, ctx);
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
    case OsEventTypeList.LONG_PRESS_EVENT: {
      armContextMenuOverlay();
      // Deferred rather than dispatched here: a tap-and-hold delivers this same event on its
      // way to opening the contextual menu, and only the FOREGROUND_ENTER that follows tells
      // the two apart. See HOLD_ACTION_DELAY_MS.
      const holdAction = toGlassAction(event, eventType);
      if (holdAction) schedulePendingHold(holdAction);
      return;
    }
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      if (contextMenuOverlayOpen) {
        trace.debug('EVT', 'foreground enter suppressed — contextual menu overlay open');
        cancelPendingHold('contextual menu overlay opened');
        return;
      }
      handleForegroundEnter();
      return;
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      if (contextMenuOverlayOpen) {
        trace.debug('EVT', 'foreground exit suppressed — contextual menu overlay closed');
        clearContextMenuOverlay();
        return;
      }
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
 * Wires the SDK event listener. Call once after the bridge is connected.
 * Idempotent against a second call (e.g. the retry button after a failed connect) —
 * re-subscribing without unsubscribing the previous listener first would
 * double-fire every gesture.
 */
export function attachGlassesListeners(): void {
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
}

/** Renders a complete screen after its event-capturing container is available. */
export async function showGlassesScreen(screen: ScreenName): Promise<void> {
  state.screen = screen;
  await renderFull();
}

/** Start the glasses runtime and render the initial menu screen. */
export async function startGlasses(): Promise<void> {
  attachGlassesListeners();
  await showGlassesScreen('menu');
}
