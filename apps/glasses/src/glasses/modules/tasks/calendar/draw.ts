/**
 * Renders a month grid into the 576×144 calendar pixel buffer. Pure function
 * of (grid, view) — no state reads, no SDK, no DOM — so every visual case is
 * a plain unit test.
 */

import { drawText, GLYPH_HEIGHT, measureText } from '../../../bitmap/font5x7';
import { createBuffer, fillRect, hLine, strokeRect } from '../../../bitmap/pixels';
import {
  CAL_BUF_H,
  CAL_BUF_W,
  CAL_COL_W,
  CAL_COL_X0,
  CAL_GRID_Y,
  CAL_ROW_H,
  CAL_WEEKDAY_Y,
} from '../../../constants';
import type { MonthGrid } from './month-grid';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SCALE = 2;
/**
 * Both in- and out-of-month days render at the same scale — the 21px row
 * height (down from 26px, to fit the shrunk buffer, see CAL_ROW_H's doc
 * comment) is too tight for the old in-month scale 3 (21px tall) alongside
 * the 2px week-cursor strokeRect. Out-of-month days are told apart by
 * `stipple` (see the drawText call below) instead of a smaller scale.
 */
const DAY_SCALE = 2;

/**
 * Row index convention for the week-picking phase: 0 = "prev month" nav
 * row, 1–6 = the six week rows, 7 = "next month" nav row. PREV MONTH / NEXT
 * MONTH themselves render as text (task-due-date.ts's topText/bottomText),
 * not in this bitmap — rows 0 and 7 just mean "no week row is outlined
 * here". In the day-picking phase, `rowIndex` stays fixed at whichever week
 * (1–6) was entered and `colIndex` (0–6) is the active column.
 */
export interface CalendarPickerView {
  phase: 'week' | 'day';
  rowIndex: number;
  colIndex: number;
  todayIso: string;
  dueIso?: string | null;
}

export function drawCalendar(grid: MonthGrid, view: CalendarPickerView): Uint8Array {
  const buf = createBuffer(CAL_BUF_W, CAL_BUF_H);

  for (const [col, letter] of WEEKDAY_INITIALS.entries()) {
    const cellX = CAL_COL_X0 + col * CAL_COL_W;
    const tx = cellX + Math.floor((CAL_COL_W - measureText(letter, WEEKDAY_SCALE)) / 2);
    drawText(buf, CAL_BUF_W, CAL_BUF_H, tx, CAL_WEEKDAY_Y, letter, { scale: WEEKDAY_SCALE });
  }

  hLine(buf, CAL_BUF_W, CAL_BUF_H, 0, CAL_GRID_Y - 1, CAL_BUF_W, 1);

  for (const [r, row] of grid.entries()) {
    const pickerRow = r + 1; // 1-based, matching CalendarPickerView.rowIndex
    const rowY = CAL_GRID_Y + r * CAL_ROW_H;
    const isWeekCursorRow = view.phase === 'week' && view.rowIndex === pickerRow;

    if (isWeekCursorRow) {
      strokeRect(buf, CAL_BUF_W, CAL_BUF_H, 0, rowY, CAL_BUF_W, CAL_ROW_H, 2, 1);
    }

    for (const [col, cell] of row.entries()) {
      const cellX = CAL_COL_X0 + col * CAL_COL_W;
      const isDayCursor =
        view.phase === 'day' && view.rowIndex === pickerRow && view.colIndex === col;
      const isToday = cell.iso === view.todayIso;
      const isDue = !!view.dueIso && cell.iso === view.dueIso;

      if (isDayCursor) {
        fillRect(buf, CAL_BUF_W, CAL_BUF_H, cellX, rowY, CAL_COL_W, CAL_ROW_H, 1);
      }

      const label = String(cell.day);
      const textW = measureText(label, DAY_SCALE);
      const tx = cellX + Math.floor((CAL_COL_W - textW) / 2);
      const ty = rowY + Math.floor((CAL_ROW_H - GLYPH_HEIGHT * DAY_SCALE) / 2);

      drawText(buf, CAL_BUF_W, CAL_BUF_H, tx, ty, label, {
        scale: DAY_SCALE,
        invert: isDayCursor,
        stipple: !cell.inMonth && !isDayCursor,
      });

      if (isToday && !isDayCursor) {
        strokeRect(
          buf,
          CAL_BUF_W,
          CAL_BUF_H,
          cellX + 1,
          rowY + 1,
          CAL_COL_W - 2,
          CAL_ROW_H - 2,
          1,
          1,
        );
      }
      if (isDue && !isDayCursor) {
        fillRect(buf, CAL_BUF_W, CAL_BUF_H, cellX + CAL_COL_W - 6, rowY + 2, 4, 4, 1);
      }
    }
  }

  return buf;
}
