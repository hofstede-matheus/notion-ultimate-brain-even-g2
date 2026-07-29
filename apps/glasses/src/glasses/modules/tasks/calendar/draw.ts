/**
 * Renders a month grid into the 576×204 calendar pixel buffer. Pure function
 * of (grid, view) — no state reads, no SDK, no DOM — so every visual case is
 * a plain unit test.
 */

import { drawText, GLYPH_HEIGHT, measureText } from '../../../bitmap/font5x7';
import { createBuffer, fillRect, hLine, setPixel, strokeRect } from '../../../bitmap/pixels';
import {
  CAL_BUF_H,
  CAL_BUF_W,
  CAL_COL_W,
  CAL_COL_X0,
  CAL_GRID_Y,
  CAL_NAV_H,
  CAL_NAV_NEXT_Y,
  CAL_ROW_H,
  CAL_WEEKDAY_Y,
} from '../../../constants';
import type { MonthGrid } from './month-grid';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SCALE = 2;
const NAV_SCALE = 2;
const DAY_SCALE_IN_MONTH = 3;
const DAY_SCALE_OUT_OF_MONTH = 2;
const CHEVRON_SIZE = 10;
const CHEVRON_GAP = 14;

/**
 * Row index convention for the week-picking phase: 0 = "prev month" nav
 * row, 1–6 = the six week rows, 7 = "next month" nav row. In the day-picking
 * phase, `rowIndex` stays fixed at whichever week (1–6) was entered and
 * `colIndex` (0–6) is the active column.
 */
export interface CalendarPickerView {
  phase: 'week' | 'day';
  rowIndex: number;
  colIndex: number;
  todayIso: string;
  dueIso?: string | null;
}

function drawChevron(
  buf: Uint8Array,
  x: number,
  y: number,
  size: number,
  direction: 'left' | 'right',
): void {
  const half = Math.floor(size / 2);
  for (let i = 0; i <= half; i++) {
    if (direction === 'left') {
      setPixel(buf, CAL_BUF_W, CAL_BUF_H, x + half - i, y + i, 1);
      setPixel(buf, CAL_BUF_W, CAL_BUF_H, x + half - i, y + size - i, 1);
    } else {
      setPixel(buf, CAL_BUF_W, CAL_BUF_H, x + i, y + i, 1);
      setPixel(buf, CAL_BUF_W, CAL_BUF_H, x + i, y + size - i, 1);
    }
  }
}

function drawNavRow(
  buf: Uint8Array,
  y: number,
  height: number,
  label: string,
  chevron: 'left' | 'right',
  active: boolean,
): void {
  if (active) fillRect(buf, CAL_BUF_W, CAL_BUF_H, 0, y, CAL_BUF_W, height, 1);
  const textW = measureText(label, NAV_SCALE);
  const totalW = textW + CHEVRON_GAP;
  const startX = Math.floor((CAL_BUF_W - totalW) / 2);
  const textY = y + Math.floor((height - GLYPH_HEIGHT * NAV_SCALE) / 2);
  const chevronY = y + Math.floor((height - CHEVRON_SIZE) / 2);
  const textOptions = { scale: NAV_SCALE, invert: active };

  if (chevron === 'left') {
    drawChevron(buf, startX, chevronY, CHEVRON_SIZE, 'left');
    drawText(buf, CAL_BUF_W, CAL_BUF_H, startX + CHEVRON_GAP, textY, label, textOptions);
  } else {
    drawText(buf, CAL_BUF_W, CAL_BUF_H, startX, textY, label, textOptions);
    drawChevron(buf, startX + textW + 4, chevronY, CHEVRON_SIZE, 'right');
  }
}

export function drawCalendar(grid: MonthGrid, view: CalendarPickerView): Uint8Array {
  const buf = createBuffer(CAL_BUF_W, CAL_BUF_H);

  drawNavRow(buf, 0, CAL_NAV_H, 'PREV MONTH', 'left', view.phase === 'week' && view.rowIndex === 0);

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

      const scale = cell.inMonth ? DAY_SCALE_IN_MONTH : DAY_SCALE_OUT_OF_MONTH;
      const label = String(cell.day);
      const textW = measureText(label, scale);
      const tx = cellX + Math.floor((CAL_COL_W - textW) / 2);
      const ty = rowY + Math.floor((CAL_ROW_H - GLYPH_HEIGHT * scale) / 2);

      drawText(buf, CAL_BUF_W, CAL_BUF_H, tx, ty, label, {
        scale,
        invert: isDayCursor,
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

  const nextH = CAL_BUF_H - CAL_NAV_NEXT_Y;
  drawNavRow(
    buf,
    CAL_NAV_NEXT_Y,
    nextH,
    'NEXT MONTH',
    'right',
    view.phase === 'week' && view.rowIndex === 7,
  );

  return buf;
}
