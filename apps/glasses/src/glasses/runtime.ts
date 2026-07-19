import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { getBridge, state } from '../state';
import * as stt from '../stt';
import { SCROLL_COOLDOWN_MS } from './constants';
import { createGlassCtx } from './context';
import { renderFull } from './render';
import { router } from './router';
import type { AppGlassAction } from './types';

const ctx = createGlassCtx();

// ---------------------------------------------------------------------------
// Event type normalisation (SDK quirk: CLICK_EVENT=0 → undefined)
// ---------------------------------------------------------------------------

function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw = event.listEvent?.eventType ?? event.textEvent?.eventType ?? event.sysEvent?.eventType;

  if (typeof raw === 'number') return raw as OsEventTypeList;

  // If an event object exists but type is undefined, it's a click (0 → undefined)
  if (event.listEvent || event.textEvent || event.sysEvent) {
    return OsEventTypeList.CLICK_EVENT;
  }

  return undefined;
}

function toGlassAction(event: EvenHubEvent, eventType: OsEventTypeList): AppGlassAction | null {
  switch (eventType) {
    case OsEventTypeList.CLICK_EVENT:
      // event.listEvent is only present for native-list containers
      // (Menu/Today/Inbox); undefined for plain text-container clicks
      // (Add Task) — itemIndex/itemName simply stay undefined there.
      //
      // Same SDK quirk as eventType above: currentSelectItemIndex=0 (the
      // first item) is dropped by the bridge's JSON encoding, arriving as
      // undefined instead of 0. Since we already know a listEvent is
      // present, default the missing index to 0 rather than leaving it
      // undefined — otherwise tapping the first item in any native list
      // (e.g. "Today's Tasks" on the menu) silently does nothing.
      return {
        type: 'SELECT_HIGHLIGHTED',
        itemIndex: event.listEvent ? (event.listEvent.currentSelectItemIndex ?? 0) : undefined,
        itemName: event.listEvent?.currentSelectItemName,
      };
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      return { type: 'GO_BACK' };
    case OsEventTypeList.SCROLL_TOP_EVENT:
      return { type: 'HIGHLIGHT_MOVE', direction: 'up' };
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      return { type: 'HIGHLIGHT_MOVE', direction: 'down' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Scroll throttle (300ms cooldown)
// ---------------------------------------------------------------------------

let lastScrollAt = 0;

function isScrollThrottled(): boolean {
  const now = Date.now();
  if (now - lastScrollAt < SCROLL_COOLDOWN_MS) return true;
  lastScrollAt = now;
  return false;
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
 * initial menu screen. Call once after the bridge is connected.
 */
export async function startGlasses(): Promise<void> {
  const b = getBridge();
  if (!b) return;
  b.onEvenHubEvent(onEvenHubEvent);
  state.screen = 'menu';
  await renderFull();
}
