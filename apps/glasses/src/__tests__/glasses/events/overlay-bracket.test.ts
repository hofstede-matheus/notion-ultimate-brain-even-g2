/**
 * events/index.ts's contextual-menu overlay guard — a menu selection is
 * bracketed by FOREGROUND_ENTER_EVENT -> menuItemClickEvent ->
 * FOREGROUND_EXIT_EVENT (docs/contextual-menu.md in even-g2-context); the
 * guard suppresses that bracket's normal foreground handling (a full
 * resetRenderSession()+renderFull(), and a log flush) so a menu tap doesn't
 * also trigger both.
 *
 * The same guard is what tells a hold apart from a tap-and-hold: both deliver
 * LONG_PRESS_EVENT, so the hold's action is deferred by HOLD_ACTION_DELAY_MS
 * and cancelled if the overlay's FOREGROUND_ENTER lands first.
 */
import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { flush } = vi.hoisted(() => ({ flush: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../logging/persist', () => ({ flush }));

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { CONTEXT_MENU_OVERLAY_MS, HOLD_ACTION_DELAY_MS } from '../../../glasses/constants';
import { TASK_CONTEXT_MENU } from '../../../glasses/context-menu';
import { startGlasses } from '../../../glasses/events';
import { clear as clearLog } from '../../../logging/sink';
import { menuItemId, mount, select } from '../harness';

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
  /** Puts the harness on Task Details for 'Buy milk' — where the menu and the hold live. */
  async function onTaskDetails(h: ReturnType<typeof mount>) {
    h.state.startupRendered = true;
    await startGlasses();
    h.state.screen = 'inbox'; // startGlasses() itself lands on 'menu' — reset the fixture screen
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(select(0));
    await h.settle();
    expect(h.state.screen).toBe('task-details');
  }

  it('runs the action without an extra render on the bracketing FOREGROUND_ENTER_EVENT', async () => {
    const h = mount();
    await onTaskDetails(h);
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_EVENT } as never }));
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

  it('a tap-and-hold does not also fire the hold action — the overlay cancels it', async () => {
    vi.useFakeTimers();
    try {
      const h = mount();
      await onTaskDetails(h);

      // Tap-and-hold on hardware: the same LONG_PRESS_EVENT a plain hold sends, followed by
      // the overlay opening. Without the cancel, the wearer would find a mark-done
      // confirmation waiting behind a menu they were only browsing.
      h.emit(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_EVENT } as never }));
      await h.settle();
      h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as never }));
      await h.settle();

      vi.advanceTimersByTime(2000);
      await h.settle();

      expect(h.state.screen).toBe('task-details');
      expect(h.state.pendingAction).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a plain hold, with no overlay following, runs the hold action', async () => {
    vi.useFakeTimers();
    try {
      const h = mount();
      await onTaskDetails(h);

      h.emit(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_EVENT } as never }));
      await h.settle();

      // Nothing has happened yet — the action is waiting to see if a menu turns up.
      expect(h.state.screen).toBe('task-details');

      vi.advanceTimersByTime(HOLD_ACTION_DELAY_MS + 50);
      await h.settle();

      expect(h.state.screen).toBe('mark-done-confirm');
      expect(h.state.pendingAction).toMatchObject({ kind: 'markDone', itemId: 't1' });

      // Let the overlay guard this long-press armed expire, so it can't leak into the next
      // test — it lives in events/index.ts's module scope, not in the harness's state.
      vi.advanceTimersByTime(CONTEXT_MENU_OVERLAY_MS);
    } finally {
      vi.useRealTimers();
    }
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
      await startGlasses();

      h.emit(ev({ sysEvent: { eventType: OsEventTypeList.LONG_PRESS_EVENT } as never }));
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
