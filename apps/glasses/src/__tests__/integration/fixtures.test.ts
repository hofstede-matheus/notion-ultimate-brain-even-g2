import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { NEXT_7_DAYS_TASKS, PAGE_DETAILS, TODAY_TASKS } from '../../__integration__/fixtures';
import { todayDateStr } from '../../glasses/modules/tasks/helpers';

describe('integration fixture due dates', () => {
  it('keeps Today tasks on the runner calendar day', () => {
    const today = todayDateStr();
    for (const task of TODAY_TASKS) {
      expect(task.dueDate).toBe(today);
    }
    expect(PAGE_DETAILS['task-mark-done']?.due).toBe(today);
  });

  it('keeps Next 7 Days tasks one day ahead', () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    for (const task of NEXT_7_DAYS_TASKS) {
      expect(task.dueDate).toBe(tomorrow);
    }
  });
});
