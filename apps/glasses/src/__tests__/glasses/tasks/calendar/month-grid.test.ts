import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  findCell,
  firstInMonthCol,
  firstWeekday,
  isoFor,
  monthLabel,
} from '../../../../glasses/modules/tasks/calendar/month-grid';

describe('daysInMonth', () => {
  it('handles a leap February', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  it('handles 30 vs 31 day months', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });
});

describe('addMonths', () => {
  it('rolls the year forward past December', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls the year backward past January', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles a multi-month jump', () => {
    expect(addMonths(2026, 6, 8)).toEqual({ year: 2027, month: 2 });
    expect(addMonths(2026, 6, -8)).toEqual({ year: 2025, month: 10 });
  });

  it('is a no-op for delta 0', () => {
    expect(addMonths(2026, 7, 0)).toEqual({ year: 2026, month: 7 });
  });
});

describe('buildMonthGrid', () => {
  it('always produces 6 rows of 7 cells', () => {
    const grid = buildMonthGrid(2026, 7);
    expect(grid).toHaveLength(6);
    for (const row of grid) expect(row).toHaveLength(7);
  });

  it('pads the front of the first week with the previous month', () => {
    // July 2026 starts on a Wednesday (index 3) — Sun/Mon/Tue are June padding.
    const grid = buildMonthGrid(2026, 7);
    expect(firstWeekday(2026, 7)).toBe(3);
    expect(grid[0]?.[0]).toMatchObject({ inMonth: false, iso: '2026-06-28' });
    expect(grid[0]?.[3]).toMatchObject({ inMonth: true, day: 1, iso: '2026-07-01' });
  });

  it('pads the back of the last week with the next month', () => {
    const grid = buildMonthGrid(2026, 7);
    const lastCell = grid[5]?.[6];
    expect(lastCell?.inMonth).toBe(false);
    expect(lastCell?.iso.startsWith('2026-08')).toBe(true);
  });

  it('a month that only needs 5 in-month weeks still gets 6 padded rows', () => {
    // April 2026 has 30 days starting on a Wednesday — fits in 5 calendar
    // weeks, but the grid stays fixed at 6.
    const grid = buildMonthGrid(2026, 4);
    expect(grid).toHaveLength(6);
    const lastRow = grid[5];
    expect(lastRow?.every((c) => !c.inMonth)).toBe(true);
  });

  it('every in-month day appears exactly once, in order', () => {
    const grid = buildMonthGrid(2026, 2);
    const inMonthDays = grid
      .flat()
      .filter((c) => c.inMonth)
      .map((c) => c.day);
    expect(inMonthDays).toEqual(Array.from({ length: daysInMonth(2026, 2) }, (_, i) => i + 1));
  });
});

describe('isoFor', () => {
  it('zero-pads month and day', () => {
    expect(isoFor(2026, 3, 5)).toBe('2026-03-05');
  });
});

describe('monthLabel', () => {
  it('formats a human-readable month + year', () => {
    expect(monthLabel(2026, 7)).toBe('July 2026');
    expect(monthLabel(2026, 12)).toBe('December 2026');
  });
});

describe('firstInMonthCol', () => {
  it('finds the first in-month cell in a padded row', () => {
    const grid = buildMonthGrid(2026, 7);
    expect(firstInMonthCol(grid[0] ?? [])).toBe(3);
  });

  it('returns 0 for a fully in-month row', () => {
    const grid = buildMonthGrid(2026, 7);
    expect(firstInMonthCol(grid[1] ?? [])).toBe(0);
  });
});

describe('findCell', () => {
  it('locates a cell by ISO date', () => {
    const grid = buildMonthGrid(2026, 7);
    expect(findCell(grid, '2026-07-01')).toEqual({ row: 0, col: 3 });
  });

  it('returns null for a date outside the grid entirely', () => {
    const grid = buildMonthGrid(2026, 7);
    expect(findCell(grid, '2099-01-01')).toBeNull();
  });
});
