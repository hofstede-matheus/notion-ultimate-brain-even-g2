/**
 * The "Change due date" flow: task-actions -> bitmap calendar -> confirm ->
 * toast, reached from the task action menu.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchInboxTasks, setTaskDueDate } from '../../../api';
import { back, mount, move, select } from '../harness';

const TASK: { id: string; name: string; dueDate?: string } = { id: 't1', name: 'Buy milk' };

function openPicker(h: ReturnType<typeof mount>, task: typeof TASK = TASK) {
  h.state.screen = 'inbox';
  h.state.lists.inbox = [task];
  h.dispatch(select(0)); // -> task-actions
  h.dispatch(select(2)); // Change due date -> task-due-date
}

/** Forces the picker's rowIndex, throwing (not `!`) if the picker isn't open. */
function setRowIndex(h: ReturnType<typeof mount>, rowIndex: number): void {
  const p = h.state.dueDatePicker;
  if (!p) throw new Error('expected dueDatePicker to be open');
  p.rowIndex = rowIndex;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('opening the calendar', () => {
  it('seeds on today when the task has no due date', () => {
    const h = mount();
    openPicker(h);

    expect(h.state.screen).toBe('task-due-date');
    expect(h.state.dueDatePicker).toMatchObject({
      taskId: 't1',
      taskName: 'Buy milk',
      returnTo: 'inbox',
      viewYear: 2026,
      viewMonth: 7,
      phase: 'week',
      todayIso: '2026-07-15',
      dueIso: null,
    });
    const display = h.render();
    expect(display.mode).toBe('bitmap');
    if (display.mode !== 'bitmap') return;
    expect(display.topText).toContain('CHANGE DUE');
    expect(display.topText).toContain('JULY 2026');
    expect(display.topText).not.toContain('Buy milk'); // full-screen layout has no room for it
    expect(display.bottomText).toContain('week');

    const picker = h.state.dueDatePicker;
    if (!picker) throw new Error('expected dueDatePicker to be open');
    picker.phase = 'day';
    const dayDisplay = h.render();
    expect(dayDisplay.mode).toBe('bitmap');
    if (dayDisplay.mode !== 'bitmap') return;
    expect(dayDisplay.bottomText).not.toBe(display.bottomText);
    expect(dayDisplay.bottomText).toContain('day');
  });

  it('seeds on the task’s current due date, in that month', () => {
    const h = mount();
    openPicker(h, { id: 't1', name: 'Buy milk', dueDate: '2026-09-03' });

    expect(h.state.dueDatePicker).toMatchObject({
      viewYear: 2026,
      viewMonth: 9,
      dueIso: '2026-09-03',
    });
  });

  it('GO_BACK from the week phase returns to task-actions', () => {
    const h = mount();
    openPicker(h);

    h.dispatch(back());

    expect(h.state.screen).toBe('task-actions');
  });
});

describe('week phase navigation', () => {
  it('swipe moves rowIndex, clamped to [0, 7]', () => {
    const h = mount();
    openPicker(h);
    const start = h.state.dueDatePicker?.rowIndex ?? 0;

    h.dispatch(move('up'));
    expect(h.state.dueDatePicker?.rowIndex).toBe(Math.max(0, start - 1));

    for (let i = 0; i < 10; i++) h.dispatch(move('up'));
    expect(h.state.dueDatePicker?.rowIndex).toBe(0);

    for (let i = 0; i < 10; i++) h.dispatch(move('down'));
    expect(h.state.dueDatePicker?.rowIndex).toBe(7);
  });

  it('tapping a week row enters day phase on that row’s first in-month day', () => {
    const h = mount();
    openPicker(h);
    setRowIndex(h, 1); // first week row (July 1 falls here)

    h.dispatch(select());

    expect(h.state.dueDatePicker).toMatchObject({ phase: 'day', rowIndex: 1, colIndex: 3 });
  });

  it('tapping the prev/next nav rows pages the month without leaving week phase', () => {
    const h = mount();
    openPicker(h);
    setRowIndex(h, 0); // "prev month" row

    h.dispatch(select());

    expect(h.state.dueDatePicker).toMatchObject({ viewYear: 2026, viewMonth: 6, phase: 'week' });

    setRowIndex(h, 7); // "next month" row
    h.dispatch(select());

    expect(h.state.dueDatePicker).toMatchObject({ viewYear: 2026, viewMonth: 7 });
  });
});

describe('day phase navigation', () => {
  function enterDayPhase(h: ReturnType<typeof mount>) {
    openPicker(h);
    setRowIndex(h, 1);
    h.dispatch(select()); // -> day phase, colIndex 3 (July 1)
  }

  it('swipe moves colIndex within the row, skipping out-of-month cells', () => {
    const h = mount();
    enterDayPhase(h);
    expect(h.state.dueDatePicker?.colIndex).toBe(3);

    h.dispatch(move('up')); // would land on col 2 (June 30, out-of-month) — must not move there
    expect(h.state.dueDatePicker?.colIndex).toBe(3);

    h.dispatch(move('down'));
    expect(h.state.dueDatePicker?.colIndex).toBe(4);
  });

  it('double-tap returns to week phase without leaving the picker', () => {
    const h = mount();
    enterDayPhase(h);

    h.dispatch(back());

    expect(h.state.screen).toBe('task-due-date');
    expect(h.state.dueDatePicker?.phase).toBe('week');
  });

  it('tapping a day opens the reschedule confirm dialog', () => {
    const h = mount();
    enterDayPhase(h);

    h.dispatch(select());

    expect(h.state.screen).toBe('due-date-confirm');
    expect(h.state.pendingAction).toMatchObject({
      kind: 'setDue',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
      date: '2026-07-01',
    });
  });
});

describe('confirming a reschedule', () => {
  function openDueDateConfirm(h: ReturnType<typeof mount>) {
    openPicker(h);
    setRowIndex(h, 1);
    h.dispatch(select()); // -> day phase
    h.dispatch(select()); // -> due-date-confirm, date 2026-07-01
  }

  it('Cancel dismisses back to the list', () => {
    const h = mount();
    openDueDateConfirm(h);

    h.dispatch(select(1)); // Cancel

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });

  it('Confirm calls setTaskDueDate, patches the list in place, and shows the toast', async () => {
    vi.mocked(setTaskDueDate).mockResolvedValue(undefined);
    const h = mount();
    openDueDateConfirm(h);

    h.dispatch(select(0)); // Confirm
    await h.settle();

    expect(setTaskDueDate).toHaveBeenCalledWith('t1', '2026-07-01');
    expect(h.state.lists.inbox).toEqual([{ id: 't1', name: 'Buy milk', dueDate: '2026-07-01' }]);
    expect(h.state.pendingAction).toBeNull();
    expect(h.state.actionToast).toMatchObject({ kind: 'setDue', date: '2026-07-01' });
    expect(h.state.screen).toBe('due-date-toast');
  });

  it('on API failure, shows the error and stays on the confirm screen', async () => {
    vi.mocked(setTaskDueDate).mockRejectedValue(new Error('offline'));
    const h = mount();
    openDueDateConfirm(h);

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.errorMessage).toBe('offline');
    expect(h.state.screen).toBe('due-date-confirm');
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('FAILED: offline');
  });

  it('refreshes the originating list 1.5s after the toast', async () => {
    vi.mocked(setTaskDueDate).mockResolvedValue(undefined);
    const h = mount();
    openDueDateConfirm(h);

    h.dispatch(select(0));
    await h.settle();
    expect(h.state.screen).toBe('due-date-toast');

    vi.advanceTimersByTime(1500);
    await h.settle();

    expect(h.state.actionToast).toBeNull();
    expect(h.state.screen).toBe('inbox');
    expect(fetchInboxTasks).toHaveBeenCalledOnce();
  });
});
