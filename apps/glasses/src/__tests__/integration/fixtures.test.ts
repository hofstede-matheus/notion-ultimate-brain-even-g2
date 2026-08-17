import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fixtureIsoDate,
  NEXT_7_DAYS_TASKS,
  PAGE_DETAILS,
  TODAY_TASKS,
} from '../../__integration__/fixtures';
import { todayDateStr } from '../../glasses/modules/tasks/helpers';

describe('fixtureIsoDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls month boundaries in local time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));

    expect(fixtureIsoDate(0)).toBe('2026-01-31');
    expect(fixtureIsoDate(1)).toBe('2026-02-01');
  });

  it('does not UTC-shift near local midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 17, 0, 30, 0));

    expect(fixtureIsoDate(0)).toBe('2026-08-17');
  });
});

describe('integration fixture due dates', () => {
  it('keeps Today tasks on the runner calendar day', () => {
    const today = todayDateStr();
    for (const task of TODAY_TASKS) {
      expect(task.dueDate).toBe(today);
    }
    expect(PAGE_DETAILS['task-mark-done']?.due).toBe(today);
  });

  it('keeps Next 7 Days tasks one day ahead', () => {
    const tomorrow = fixtureIsoDate(1);
    for (const task of NEXT_7_DAYS_TASKS) {
      expect(task.dueDate).toBe(tomorrow);
    }
  });
});
