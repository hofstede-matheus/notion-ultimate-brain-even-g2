import type { Task } from '@notion-ub/contracts';
import { format, parse } from 'date-fns';
import type { AppState } from '../../../state';

/**
 * Returns today's local date as YYYY-MM-DD, matching the format tasks'
 * dueDate strings are compared against.
 *
 * Uses date-fns `format` (local calendar components) — never `toISOString()`,
 * which would serialize as UTC and roll back to the previous day for users
 * ahead of UTC, misclassifying yesterday's tasks as today (and dropping
 * them from Overdue).
 */
export function todayDateStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Today and Overdue are both filtered views over the one array fetched from
 * /api/tasks/today (due today or before) — stored under the 'today' key
 * (see _shared/navigation.ts's DATA_KEY_OVERRIDES).
 */
function todayFetchedTasks(state: AppState): Task[] {
  return (state.lists.today ?? []) as Task[];
}

/**
 * Returns tasks whose due date is before today, oldest first (source order
 * preserved). Shown on the Overdue screen.
 */
export function getOverdueFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr();
  return todayFetchedTasks(state).filter((t) => t.dueDate && t.dueDate < todayStr);
}

/**
 * Returns tasks due today (not overdue). Shown on the Today screen.
 */
export function getTodayFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr();
  return todayFetchedTasks(state).filter((t) => t.dueDate === todayStr);
}

/**
 * Formats a task's due date (YYYY-MM-DD) as friendly text, e.g. "Jul 4, 2026".
 * Missing/empty dates render as "(none)".
 *
 * Uses `parse` (local midnight), not `parseISO` — `parseISO('YYYY-MM-DD')`
 * is UTC midnight and can display the wrong calendar day.
 */
export function formatDueDate(iso: string | null): string {
  if (!iso) return '(none)';
  return format(parse(iso, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy');
}
