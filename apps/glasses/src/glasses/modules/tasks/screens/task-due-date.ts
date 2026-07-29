import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { drawCalendar } from '../calendar/draw';
import { buildMonthGrid, monthLabel } from '../calendar/month-grid';

export const taskDueDateScreen: ScreenModule = {
  display(state) {
    const p = state.dueDatePicker;
    if (!p) {
      return { mode: 'text', content: 'No task selected.' };
    }

    const grid = buildMonthGrid(p.viewYear, p.viewMonth);
    const pixels = drawCalendar(grid, {
      phase: p.phase,
      rowIndex: p.rowIndex,
      colIndex: p.colIndex,
      todayIso: p.todayIso,
      dueIso: p.dueIso,
    });

    const topText = [
      buildHeaderLine('CHANGE DUE', ''),
      monthLabel(p.viewYear, p.viewMonth).toUpperCase(),
    ].join('\n');
    const bottomText =
      p.phase === 'week'
        ? 'Swipe: week · Tap: enter · 2x: back'
        : 'Swipe: day · Tap: save · 2x: back';

    return { mode: 'bitmap', topText, bottomText, pixels };
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.dueDatePickerBack();
      return;
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      ctx.selectDueDateCell();
      return;
    }
    ctx.moveDueDateCursor(action.direction);
  },
};
