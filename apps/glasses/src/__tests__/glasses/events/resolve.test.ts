/**
 * Pure event -> action mapping (resolveEventType/toGlassAction) and the
 * scroll-event cooldown (isScrollThrottled). No harness needed — these
 * functions take no ctx/state.
 */

import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveEventType, toGlassAction } from '../../../glasses/events/resolve';

function ev(partial: Partial<EvenHubEvent>): EvenHubEvent {
  return partial as EvenHubEvent;
}

describe('resolveEventType', () => {
  it('returns the raw event type when present', () => {
    expect(
      resolveEventType(
        ev({ textEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT } } as never),
      ),
    ).toBe(OsEventTypeList.DOUBLE_CLICK_EVENT);
  });

  it('defaults a listEvent with no eventType to CLICK_EVENT (proto3 drops 0)', () => {
    expect(resolveEventType(ev({ listEvent: {} } as never))).toBe(OsEventTypeList.CLICK_EVENT);
  });

  it('defaults a textEvent with no eventType to CLICK_EVENT', () => {
    expect(resolveEventType(ev({ textEvent: {} } as never))).toBe(OsEventTypeList.CLICK_EVENT);
  });

  it('returns undefined when no event object is present at all', () => {
    expect(resolveEventType(ev({}))).toBeUndefined();
  });
});

describe('toGlassAction', () => {
  it('CLICK on a list event carries the selected index and name', () => {
    const event = ev({
      listEvent: { currentSelectItemIndex: 2, currentSelectItemName: 'Inbox' },
    } as never);
    expect(toGlassAction(event, OsEventTypeList.CLICK_EVENT)).toEqual({
      type: 'SELECT_HIGHLIGHTED',
      itemIndex: 2,
      itemName: 'Inbox',
    });
  });

  it('defaults a missing index to 0 when a listEvent is present (the first-item quirk)', () => {
    const event = ev({ listEvent: {} } as never);
    expect(toGlassAction(event, OsEventTypeList.CLICK_EVENT)).toEqual({
      type: 'SELECT_HIGHLIGHTED',
      itemIndex: 0,
      itemName: undefined,
    });
  });

  it('leaves itemIndex/itemName undefined for a plain text-container click', () => {
    const event = ev({ textEvent: {} } as never);
    expect(toGlassAction(event, OsEventTypeList.CLICK_EVENT)).toEqual({
      type: 'SELECT_HIGHLIGHTED',
      itemIndex: undefined,
      itemName: undefined,
    });
  });

  it('DOUBLE_CLICK -> GO_BACK', () => {
    expect(toGlassAction(ev({}), OsEventTypeList.DOUBLE_CLICK_EVENT)).toEqual({ type: 'GO_BACK' });
  });

  it('SCROLL_TOP/SCROLL_BOTTOM -> HIGHLIGHT_MOVE up/down', () => {
    expect(toGlassAction(ev({}), OsEventTypeList.SCROLL_TOP_EVENT)).toEqual({
      type: 'HIGHLIGHT_MOVE',
      direction: 'up',
    });
    expect(toGlassAction(ev({}), OsEventTypeList.SCROLL_BOTTOM_EVENT)).toEqual({
      type: 'HIGHLIGHT_MOVE',
      direction: 'down',
    });
  });
});

describe('isScrollThrottled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first scroll, then throttles a second one inside the cooldown window', async () => {
    const { isScrollThrottled } = await import('../../../glasses/events/resolve');

    expect(isScrollThrottled()).toBe(false);
    expect(isScrollThrottled()).toBe(true);

    vi.advanceTimersByTime(299);
    expect(isScrollThrottled()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isScrollThrottled()).toBe(false);
  });
});
