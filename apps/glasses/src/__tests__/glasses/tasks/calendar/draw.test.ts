import { describe, expect, it } from 'vitest';
import { drawText } from '../../../../glasses/bitmap/font5x7';
import { createBuffer, getPixel } from '../../../../glasses/bitmap/pixels';
import {
  CAL_BUF_H,
  CAL_BUF_W,
  CAL_COL_W,
  CAL_COL_X0,
  CAL_GRID_Y,
  CAL_ROW_H,
} from '../../../../glasses/constants';
import { drawCalendar } from '../../../../glasses/modules/tasks/calendar/draw';
import { buildMonthGrid } from '../../../../glasses/modules/tasks/calendar/month-grid';

const grid = buildMonthGrid(2026, 7); // July 2026 — day 1 at row 0, col 3

describe('drawCalendar', () => {
  it('produces a full 576x144 buffer', () => {
    const buf = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    expect(buf.length).toBe(CAL_BUF_W * CAL_BUF_H);
  });

  it('differs between week-cursor and day-cursor views of the same grid', () => {
    const weekView = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 2,
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    const dayView = drawCalendar(grid, {
      phase: 'day',
      rowIndex: 2,
      colIndex: 3,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    expect(weekView).not.toEqual(dayView);
  });

  it('the day-cursor cell is filled solid (every pixel in its cell block is on)', () => {
    const buf = drawCalendar(grid, {
      phase: 'day',
      rowIndex: 1,
      colIndex: 3, // July 1, at row 0 (picker row 1), col 3
      todayIso: '2026-07-15',
      dueIso: null,
    });
    const cellX = CAL_COL_X0 + 3 * CAL_COL_W;
    const rowY = CAL_GRID_Y;
    // Sample the top-left corner and a mid-cell pixel that's never part of any glyph stroke.
    expect(getPixel(buf, CAL_BUF_W, cellX, rowY)).toBe(1);
    expect(getPixel(buf, CAL_BUF_W, cellX + 1, rowY + CAL_ROW_H - 2)).toBe(1);
  });

  it('a week not under the cursor draws no full-row highlight', () => {
    const cursorView = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    const noneSelected = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 0, // prev-month nav row selected instead
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    // Row 1's band (the strokeRect outline) should differ between the two.
    const rowY = CAL_GRID_Y;
    let differs = false;
    for (let x = 0; x < CAL_BUF_W; x++) {
      if (getPixel(cursorView, CAL_BUF_W, x, rowY) !== getPixel(noneSelected, CAL_BUF_W, x, rowY)) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it("today's cell gets an outline distinct from an ordinary day", () => {
    const withToday = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2026-07-01', // the in-month day at row 0, col 3
      dueIso: null,
    });
    const withoutToday = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2099-01-01', // not in this grid at all
      dueIso: null,
    });
    expect(withToday).not.toEqual(withoutToday);
  });

  it('the due-date marker only appears when dueIso is set and present in the grid', () => {
    const withDue = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: '2026-07-10',
    });
    const withoutDue = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 1,
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    expect(withDue).not.toEqual(withoutDue);
  });

  it('an out-of-month day is stippled and an in-month day is solid, at the same scale', () => {
    // Both render at the same scale now (the shrunk row height doesn't
    // leave room for a bigger in-month scale alongside the week-cursor
    // outline) — out-of-month days are told apart by stippling instead.
    const buf = drawCalendar(grid, {
      phase: 'week',
      rowIndex: 3, // cursor elsewhere, so row 0's band highlight doesn't contaminate the pixel count
      colIndex: 0,
      todayIso: '2026-07-15',
      dueIso: null,
    });
    const outCell = grid[0]?.[0]; // June padding at the front of the grid
    const inCell = grid[0]?.[3]; // July 1, in-month
    expect(outCell?.inMonth).toBe(false);
    expect(inCell?.inMonth).toBe(true);

    const rowY = CAL_GRID_Y;
    function countCellPixels(source: Uint8Array, col: number): number {
      const cellX = CAL_COL_X0 + col * CAL_COL_W;
      let count = 0;
      for (let y = 0; y < CAL_ROW_H; y++) {
        for (let x = 0; x < CAL_COL_W; x++) {
          count += getPixel(source, CAL_BUF_W, cellX + x, rowY + y);
        }
      }
      return count;
    }

    function renderCellAt(label: string, col: number, stipple: boolean): number {
      const scratch = createBuffer(CAL_BUF_W, CAL_BUF_H);
      const cellX = CAL_COL_X0 + col * CAL_COL_W;
      drawText(scratch, CAL_BUF_W, CAL_BUF_H, cellX, rowY, label, { scale: 2, stipple });
      return countCellPixels(scratch, col);
    }

    const outLabel = String(outCell?.day);
    const outSolid = renderCellAt(outLabel, 0, false);
    const outStippled = renderCellAt(outLabel, 0, true);
    expect(outStippled).toBeGreaterThan(0);
    expect(outStippled).toBeLessThan(outSolid); // sanity: stippling really removes some pixels
    expect(countCellPixels(buf, 0)).toBe(outStippled); // the actual cell matches the stippled rendering

    const inLabel = String(inCell?.day);
    const inSolid = renderCellAt(inLabel, 3, false);
    expect(inSolid).toBeGreaterThan(0);
    expect(countCellPixels(buf, 3)).toBe(inSolid); // the actual cell is solid, not stippled
  });
});
