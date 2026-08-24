/**
 * pendingTasks.ts — the per-entry status labels the Status screen's pending
 * card renders. Pure logic, so no component harness is involved.
 */

import { describe, expect, it } from 'vitest';
import type { QueuedTask } from '../../offline-queue';
import { MAX_ATTEMPTS } from '../../offline-queue';
import { canSync, describeEntry, summarize } from '../../web/screens/pendingTasks';

const NOW = new Date('2026-08-24T12:00:00Z').getTime();
const MINUTE = 60_000;

const entry = (over: Partial<QueuedTask> = {}): QueuedTask => ({
  id: 'a',
  name: 'buy oat milk',
  queuedAt: NOW - 2 * MINUTE,
  attempts: 0,
  ...over,
});

describe('describeEntry', () => {
  it('describes an untried entry as waiting, with how long it has been there', () => {
    expect(describeEntry(entry(), NOW)).toEqual({
      label: 'waiting · 2 minutes ago',
      tone: 'dim',
    });
  });

  it('shows the attempt count once retries have started', () => {
    expect(describeEntry(entry({ attempts: 2 }), NOW)).toEqual({
      label: `attempt 2 of ${MAX_ATTEMPTS} · 2 minutes ago`,
      tone: 'active',
    });
  });

  it('reports a given-up entry as failed, in the negative tone', () => {
    expect(describeEntry(entry({ attempts: MAX_ATTEMPTS, failed: true }), NOW)).toEqual({
      label: `failed after ${MAX_ATTEMPTS} tries`,
      tone: 'negative',
    });
  });

  it('prefers the failed label over the retrying one', () => {
    expect(describeEntry(entry({ attempts: 3, failed: true }), NOW).tone).toBe('negative');
  });

  it('reads the age from the passed clock, not the wall clock', () => {
    const older = describeEntry(entry({ queuedAt: NOW - 90 * MINUTE }), NOW);
    expect(older.label).toContain('about 2 hours ago');
  });
});

describe('summarize', () => {
  it('uses the singular for one entry', () => {
    expect(summarize([entry()])).toBe('1 pending task');
  });

  it('uses the plural for several', () => {
    expect(summarize([entry(), entry({ id: 'b' })])).toBe('2 pending tasks');
  });

  it('calls out how many have been given up on', () => {
    expect(summarize([entry(), entry({ id: 'b', failed: true })])).toBe(
      '2 pending tasks · 1 failed',
    );
  });
});

describe('canSync', () => {
  it('is true while anything is still retryable', () => {
    expect(canSync([entry({ failed: true }), entry({ id: 'b' })])).toBe(true);
  });

  it('is false once everything has been given up on', () => {
    expect(canSync([entry({ failed: true })])).toBe(false);
  });

  it('is false for an empty queue', () => {
    expect(canSync([])).toBe(false);
  });
});
