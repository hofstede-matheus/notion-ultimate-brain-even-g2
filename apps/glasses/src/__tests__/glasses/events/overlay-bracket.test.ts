/**
 * events/index.ts's contextual-menu overlay guard — a menu selection is
 * bracketed by FOREGROUND_ENTER_EVENT -> menuItemClickEvent ->
 * FOREGROUND_EXIT_EVENT (docs/contextual-menu.md in even-g2-context); the
 * guard suppresses that bracket's normal foreground handling (a full
 * resetRenderSession()+renderFull(), and a log flush) so a menu tap doesn't
 * also trigger both.
 */
import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { flush } = vi.hoisted(() => ({ flush: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../logging/persist', () => ({ flush }));

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { TASK_CONTEXT_MENU } from '../../../glasses/context-menu';
import { startGlasses } from '../../../glasses/events';
import { clear as clearLog } from '../../../logging/sink';
import { menuItemId, mount } from '../harness';

/** Builds a partial EvenHubEvent for tests — the SDK's nested types are classes with a
 * toJson() method tests don't need. */
function ev(partial: Partial<EvenHubEvent>): EvenHubEvent {
  return partial as EvenHubEvent;
}

const MARK_AS_DONE_ID = menuItemId(TASK_CONTEXT_MENU, 'Mark as done');

beforeEach(() => {
  vi.clearAllMocks();
  clearLog();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a menu selection', () => {
  it('runs the action without an extra render on the bracketing FOREGROUND_ENTER_EVENT', async () => {
    const h = mount();
    h.state.startupRendered = true;
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    await startGlasses();
    h.state.screen = 'inbox'; // startGlasses() itself lands on 'menu' — reset the fixture screen
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(
      ev({
        listEvent: {
          eventType: OsEventTypeList.LONG_PRESS_EVENT,
          currentSelectItemIndex: 0,
        } as never,
      }),
    );
    await h.settle();
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as never }));
    await h.settle();

    // The bracket's enter is suppressed — a real background/foreground
    // cycle's full rebuild must not fire for a menu tap.
    expect(h.bridge.rebuildPageContainer).not.toHaveBeenCalled();

    h.emit(ev({ menuItemClickEvent: { itemID: MARK_AS_DONE_ID } as never }));
    await h.settle();

    expect(h.state.screen).toBe('mark-done-confirm');
    expect(h.state.pendingAction).toMatchObject({ kind: 'markDone', itemId: 't1' });

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT } as never }));
    await h.settle();

    // The bracket's trailing exit means the overlay closed, not that the app
    // backgrounded — the log must not be flushed for it.
    expect(flush).not.toHaveBeenCalled();
  });

  it('a FOREGROUND_ENTER_EVENT with no preceding long-press redraws normally', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as never }));
    await h.settle();

    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });

  it('a FOREGROUND_EXIT_EVENT with no preceding long-press still flushes the log', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT } as never }));
    await h.settle();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('the overlay guard times out, so a dismissal with no selection cannot wedge later foreground handling', async () => {
    vi.useFakeTimers();
    try {
      const h = mount();
      h.state.startupRendered = true;
      h.state.screen = 'inbox';
      h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
      await startGlasses();
      h.state.screen = 'inbox';

      h.emit(
        ev({
          listEvent: {
            eventType: OsEventTypeList.LONG_PRESS_EVENT,
            currentSelectItemIndex: 0,
          } as never,
        }),
      );
      await h.settle();

      // Dismissed without picking anything — no menuItemClickEvent, no
      // FOREGROUND_EXIT_EVENT ever arrives to clear the guard naturally.
      vi.advanceTimersByTime(2100);

      h.bridge.rebuildPageContainer.mockClear();
      h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as never }));
      await h.settle();

      expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
