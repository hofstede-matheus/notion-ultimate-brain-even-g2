import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { trace } from '../../logging/trace';
import { SCROLL_COOLDOWN_MS } from '../constants';
import type { AppGlassAction } from '../types';

// ---------------------------------------------------------------------------
// Event type normalisation (SDK quirk: CLICK_EVENT=0 → undefined)
// ---------------------------------------------------------------------------

/**
 * Human-readable name for a numeric OsEventTypeList value, for logging.
 * Hand-mapped rather than relying on the enum's reverse mapping — the SDK
 * ships a minified bundle, and numeric-enum reverse lookup isn't guaranteed
 * to survive that.
 */
const EVENT_TYPE_NAMES: Record<number, string> = {
  [OsEventTypeList.CLICK_EVENT]: 'CLICK_EVENT',
  [OsEventTypeList.SCROLL_TOP_EVENT]: 'SCROLL_TOP_EVENT',
  [OsEventTypeList.SCROLL_BOTTOM_EVENT]: 'SCROLL_BOTTOM_EVENT',
  [OsEventTypeList.DOUBLE_CLICK_EVENT]: 'DOUBLE_CLICK_EVENT',
  [OsEventTypeList.FOREGROUND_ENTER_EVENT]: 'FOREGROUND_ENTER_EVENT',
  [OsEventTypeList.FOREGROUND_EXIT_EVENT]: 'FOREGROUND_EXIT_EVENT',
  [OsEventTypeList.ABNORMAL_EXIT_EVENT]: 'ABNORMAL_EXIT_EVENT',
  [OsEventTypeList.SYSTEM_EXIT_EVENT]: 'SYSTEM_EXIT_EVENT',
  [OsEventTypeList.IMU_DATA_REPORT]: 'IMU_DATA_REPORT',
};

export function eventTypeName(eventType: OsEventTypeList): string {
  return EVENT_TYPE_NAMES[eventType] ?? `unknown(${eventType})`;
}

export function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw = event.listEvent?.eventType ?? event.textEvent?.eventType ?? event.sysEvent?.eventType;

  if (typeof raw === 'number') return raw as OsEventTypeList;

  // If an event object exists but type is undefined, it's a click (0 → undefined)
  if (event.listEvent || event.textEvent || event.sysEvent) {
    return OsEventTypeList.CLICK_EVENT;
  }

  trace.warn('EVT', 'unrecognised event dropped', {
    keys: Object.keys(event).join(','),
  });
  return undefined;
}

export function toGlassAction(
  event: EvenHubEvent,
  eventType: OsEventTypeList,
): AppGlassAction | null {
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
      trace.warn('EVT', `${eventTypeName(eventType)} has no action mapping`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Scroll throttle (300ms cooldown)
// ---------------------------------------------------------------------------

let lastScrollAt = 0;

export function isScrollThrottled(): boolean {
  const now = Date.now();
  if (now - lastScrollAt < SCROLL_COOLDOWN_MS) {
    trace.debug('EVT', `scroll throttled (<${SCROLL_COOLDOWN_MS}ms)`);
    return true;
  }
  lastScrollAt = now;
  return false;
}
