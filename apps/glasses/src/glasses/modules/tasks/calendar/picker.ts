/**
 * Due-date picker business logic — mutates `state.dueDatePicker` and drives
 * navigation/render. The bitmap itself is pure (see draw.ts); this is where
 * gestures turn into calendar-state transitions.
 */
import { trace } from '../../../../logging/trace';
import { state } from '../../../../state';
import { renderFull } from '../../../render';
import { ITEM_ACTIONS, openConfirm as openItemConfirm } from '../../_shared/item-actions';
import { navigate } from '../../_shared/navigation';
import { todayDateStr } from '../helpers';
import {
  addMonths,
  buildMonthGrid,
  findCell,
  firstInMonthCol,
  type MonthGridCell,
} from './month-grid';

type DueDatePicker = NonNullable<typeof state.dueDatePicker>;

function currentRow(p: DueDatePicker): MonthGridCell[] {
  const grid = buildMonthGrid(p.viewYear, p.viewMonth);
  return grid[p.rowIndex - 1] ?? [];
}

/** Opens the calendar for `state.selectedTask`, seeded on its current due date (or today). */
export function openDueDatePicker(): void {
  const selected = state.selectedTask;
  if (!selected) return;

  const todayIso = todayDateStr();
  const seedIso = selected.dueDate ?? todayIso;
  const [seedYear, seedMonth] = seedIso.split('-').map(Number);
  const viewYear = seedYear ?? Number(todayIso.slice(0, 4));
  const viewMonth = seedMonth ?? Number(todayIso.slice(5, 7));

  const grid = buildMonthGrid(viewYear, viewMonth);
  const found = findCell(grid, seedIso);

  state.dueDatePicker = {
    taskId: selected.taskId,
    taskName: selected.taskName,
    returnTo: selected.returnTo,
    viewYear,
    viewMonth,
    phase: 'week',
    rowIndex: found ? found.row + 1 : 1,
    colIndex: found ? found.col : 0,
    todayIso,
    dueIso: selected.dueDate ?? null,
  };

  trace.info('NAV', `openDueDatePicker "${selected.taskName}"`, { id: selected.taskId, seedIso });
  navigate('task-due-date');
}

function moveWithinRow(row: MonthGridCell[], colIndex: number, delta: number): number {
  let next = colIndex;
  while (next + delta >= 0 && next + delta <= 6) {
    next += delta;
    if (row[next]?.inMonth) return next;
  }
  return colIndex;
}

export function moveDueDateCursor(direction: 'up' | 'down'): void {
  const p = state.dueDatePicker;
  if (!p) return;
  const delta = direction === 'down' ? 1 : -1;

  if (p.phase === 'week') {
    p.rowIndex = Math.min(7, Math.max(0, p.rowIndex + delta));
  } else {
    p.colIndex = moveWithinRow(currentRow(p), p.colIndex, delta);
  }
  void renderFull();
}

function pageMonth(p: DueDatePicker, delta: number): void {
  const next = addMonths(p.viewYear, p.viewMonth, delta);
  p.viewYear = next.year;
  p.viewMonth = next.month;
  trace.info('CAL', `month -> ${next.year}-${String(next.month).padStart(2, '0')}`);
  void renderFull();
}

export function selectDueDateCell(): void {
  const p = state.dueDatePicker;
  if (!p) return;

  if (p.phase === 'week') {
    if (p.rowIndex === 0) {
      pageMonth(p, -1);
      return;
    }
    if (p.rowIndex === 7) {
      pageMonth(p, 1);
      return;
    }

    p.phase = 'day';
    p.colIndex = firstInMonthCol(currentRow(p));
    trace.info('CAL', 'phase week -> day', { row: p.rowIndex });
    void renderFull();
    return;
  }

  const cell = currentRow(p)[p.colIndex];
  if (!cell) return;
  trace.info('ACT', `due date selected ${cell.iso}`, { taskId: p.taskId });
  openItemConfirm(ITEM_ACTIONS.setDue, p.taskId, p.taskName, p.returnTo, { date: cell.iso });
}

export function dueDatePickerBack(): void {
  const p = state.dueDatePicker;
  if (!p) return;

  if (p.phase === 'day') {
    p.phase = 'week';
    trace.info('CAL', 'phase day -> week');
    void renderFull();
    return;
  }

  navigate('task-actions');
}
