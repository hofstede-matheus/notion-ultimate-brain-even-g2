/**
 * Display logic for the pending-tasks card. Split out from
 * ./components/PendingTasksCard.tsx so it's unit-testable without a component
 * test harness (none exists in this repo — see vitest.config.ts's
 * `src/__tests__/**` include, which collects .test.ts only).
 */

import { formatDistance } from 'date-fns';
import { MAX_ATTEMPTS, type QueuedTask } from '../../offline-queue';

export type Tone = 'dim' | 'active' | 'negative';

export interface EntryDescription {
  /** Right-hand status label, e.g. "waiting · 2 minutes ago". */
  label: string;
  tone: Tone;
}

/**
 * `now` is a parameter rather than an internal Date.now() so the relative
 * phrase is pinnable in tests.
 */
export function describeEntry(entry: QueuedTask, now: number = Date.now()): EntryDescription {
  const age = `${formatDistance(entry.queuedAt, now)} ago`;

  if (entry.failed) {
    return { label: `failed after ${entry.attempts} tries`, tone: 'negative' };
  }
  if (entry.attempts > 0) {
    return { label: `attempt ${entry.attempts} of ${MAX_ATTEMPTS} · ${age}`, tone: 'active' };
  }
  return { label: `waiting · ${age}`, tone: 'dim' };
}

/** Card heading — the count is the thing the user actually scans for. */
export function summarize(entries: QueuedTask[]): string {
  const failed = entries.filter((e) => e.failed).length;
  const noun = entries.length === 1 ? 'task' : 'tasks';
  if (failed > 0) return `${entries.length} pending ${noun} · ${failed} failed`;
  return `${entries.length} pending ${noun}`;
}

/** Sync now is pointless once everything left has been given up on. */
export function canSync(entries: QueuedTask[]): boolean {
  return entries.some((e) => !e.failed);
}
