import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { trace } from '../../logging/trace';
import { getBridge, state } from '../../state';
import * as stt from '../../stt';
import { createGlassCtx } from '../glass-ctx';
import { renderFull } from '../render';
import { router } from '../router';
import { eventTypeName, isScrollThrottled, resolveEventType, toGlassAction } from './resolve';

const ctx = createGlassCtx();

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
