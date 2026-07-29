/**
 * Pure calendar date math for the due-date picker — no `Date`-to-ISO
 * round-tripping (no `toISOString()`), matching the local-components idiom
 * `../helpers.ts`'s `todayDateStr()` uses and for the same reason: a UTC
 * round-trip rolls the date back a day for users ahead of UTC.
 */

export interface MonthGridCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Always 6 rows × 7 columns (Sun–Sat) so the bitmap layout is a fixed size regardless of the month. */
export type MonthGrid = MonthGridCell[][];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoFor(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** `month` is 1-based (1 = January). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Sunday. `month` is 1-based. */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** `month` is 1-based; `delta` may be negative. Rolls the year over correctly either direction. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = month - 1 + delta;
  const newYear = year + Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function monthLabel(year: number, month: number): string {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[month - 1]} ${year}`;
}

/** Builds a fixed 6×7 grid for `month` (1-based), padded with adjacent months' days. */
export function buildMonthGrid(year: number, month: number): MonthGrid {
  const fw = firstWeekday(year, month);
  const dim = daysInMonth(year, month);
  const prev = addMonths(year, month, -1);
  const prevDim = daysInMonth(prev.year, prev.month);
  const next = addMonths(year, month, 1);

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - fw;
    if (offset < 0) {
      const day = prevDim + offset + 1;
      cells.push({ iso: isoFor(prev.year, prev.month, day), day, inMonth: false });
    } else if (offset >= dim) {
      const day = offset - dim + 1;
      cells.push({ iso: isoFor(next.year, next.month, day), day, inMonth: false });
    } else {
      const day = offset + 1;
      cells.push({ iso: isoFor(year, month, day), day, inMonth: true });
    }
  }

  const weeks: MonthGrid = [];
  for (let r = 0; r < 6; r++) weeks.push(cells.slice(r * 7, r * 7 + 7));
  return weeks;
}

/** Column of the first in-month day in a week row — used as the entry cursor when a week is picked. Falls back to 0 for an all-padding row (never happens with a fixed 6-row grid over a real month, but keeps this total). */
export function firstInMonthCol(row: MonthGridCell[]): number {
  const idx = row.findIndex((cell) => cell.inMonth);
  return idx === -1 ? 0 : idx;
}

/** Locates `iso` in the grid, if present. */
export function findCell(grid: MonthGrid, iso: string): { row: number; col: number } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const c = row.findIndex((cell) => cell.iso === iso);
    if (c !== -1) return { row: r, col: c };
  }
  return null;
}
