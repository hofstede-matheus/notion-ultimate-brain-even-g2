import { describe, expect, it } from 'vitest';
import {
  backoffMs,
  errorCode,
  jitter,
  MAX_RETRIES,
  NON_RETRYABLE_CODES,
  RETRY_SAFE_METHODS,
  RETRYABLE_STATUSES,
  withinBudget,
} from '../../http/retry';

describe('backoffMs', () => {
  it('grows by FACTOR per attempt, nominal (non-jittered)', () => {
    expect(backoffMs(1)).toBe(400);
    expect(backoffMs(2)).toBe(1200);
  });
});

describe('jitter', () => {
  it('returns the lower bound (d/2) when rand is 0', () => {
    expect(jitter(400, () => 0)).toBe(200);
  });

  it('returns the midpoint when rand is 0.5', () => {
    expect(jitter(400, () => 0.5)).toBe(300);
  });

  it('approaches the upper bound (d) as rand approaches 1', () => {
    expect(jitter(400, () => 0.999)).toBeCloseTo(400, 0);
  });

  it('defaults to Math.random when rand is omitted', () => {
    const result = jitter(400);
    expect(result).toBeGreaterThanOrEqual(200);
    expect(result).toBeLessThanOrEqual(400);
  });
});

describe('errorCode', () => {
  it('extracts a string code field from a parsed object body', () => {
    expect(errorCode({ error: 'nope', code: 'validation_error' })).toBe('validation_error');
  });

  it('returns undefined when there is no code field', () => {
    expect(errorCode({ error: 'nope' })).toBeUndefined();
  });

  it('returns undefined for a non-object body (already-consumed text, empty, etc.)', () => {
    expect(errorCode('plain text body')).toBeUndefined();
    expect(errorCode(undefined)).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });

  it('returns undefined when code is present but not a string', () => {
    expect(errorCode({ code: 42 })).toBeUndefined();
  });
});

describe('withinBudget', () => {
  it('is true when the nominal wait for the next attempt fits before the deadline', () => {
    const now = 1_000_000;
    const deadline = now + 1000;
    // backoffMs(1) === 400, so now + 400 < deadline (now + 1000) — fits.
    expect(withinBudget(now, 1, deadline)).toBe(true);
  });

  it('is false once the nominal wait would land at or past the deadline', () => {
    const now = 1_000_000;
    // backoffMs(1) === 400 — a deadline only 400ms out is exactly consumed, not left with room.
    expect(withinBudget(now, 1, now + 400)).toBe(false);
  });

  it('is false once the deadline has already passed', () => {
    const now = 1_000_000;
    expect(withinBudget(now, 1, now - 1)).toBe(false);
  });

  it('accounts for backoff growing with retryCount', () => {
    const now = 1_000_000;
    // backoffMs(2) === 1200 — a 1000ms-out deadline fits attempt 1 (400) but not attempt 2 (1200).
    expect(withinBudget(now, 1, now + 1000)).toBe(true);
    expect(withinBudget(now, 2, now + 1000)).toBe(false);
  });
});

describe('policy tables', () => {
  it("RETRYABLE_STATUSES is ky's default minus 413, plus 425", () => {
    expect([...RETRYABLE_STATUSES].sort((a, b) => a - b)).toEqual([
      408, 425, 429, 500, 502, 503, 504,
    ]);
  });

  it('NON_RETRYABLE_CODES covers the config-health-shaped Notion error codes', () => {
    expect(NON_RETRYABLE_CODES.has('validation_error')).toBe(true);
    expect(NON_RETRYABLE_CODES.has('object_not_found')).toBe(true);
    expect(NON_RETRYABLE_CODES.has('rate_limited')).toBe(false);
  });

  it('RETRY_SAFE_METHODS is GET/HEAD/PATCH/DELETE — POST is deliberately excluded', () => {
    expect(RETRY_SAFE_METHODS.has('GET')).toBe(true);
    expect(RETRY_SAFE_METHODS.has('HEAD')).toBe(true);
    expect(RETRY_SAFE_METHODS.has('PATCH')).toBe(true);
    expect(RETRY_SAFE_METHODS.has('DELETE')).toBe(true);
    expect(RETRY_SAFE_METHODS.has('POST')).toBe(false);
  });

  it('MAX_RETRIES is 2 (3 attempts total)', () => {
    expect(MAX_RETRIES).toBe(2);
  });
});
