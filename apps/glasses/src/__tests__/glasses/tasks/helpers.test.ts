import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDueDate, todayDateStr } from '../../../glasses/modules/tasks/helpers';

describe('todayDateStr', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not UTC-shift near local midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 17, 0, 30, 0));

    expect(todayDateStr()).toBe('2026-08-17');
  });

  it('rolls month boundaries in local time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));

    expect(todayDateStr()).toBe('2026-01-31');
  });
});

describe('formatDueDate', () => {
  it('formats a YYYY-MM-DD string in local calendar terms', () => {
    expect(formatDueDate('2026-07-04')).toBe('Jul 4, 2026');
  });

  it('renders null as (none)', () => {
    expect(formatDueDate(null)).toBe('(none)');
  });
});
