/**
 * fetchAllPages — the client-side cursor loop that replaces the old
 * server-side page_size cap. See apps/server/src/routes.ts's header comment
 * ("pagination loops... belong in the glasses app").
 *
 * fetchAllPages now passes a second `{ deadline }` argument to `fetchPage` on every round —
 * a shared budget so a transient failure partway through a long list doesn't retry on every
 * one of up to 50 rounds unbounded (see pagination.ts's LIST_BUDGET_MS). Existing assertions
 * below are updated to match this deliberate behaviour change, not loosened.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from '../../../glasses/modules/_shared/pagination';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('fetchAllPages', () => {
  it('returns everything from a single page when hasMore is false', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [{ id: '1' }, { id: '2' }],
      hasMore: false,
      nextCursor: null,
    });

    const items = await fetchAllPages(fetchPage);

    expect(items).toEqual([{ id: '1' }, { id: '2' }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined, { deadline: expect.any(Number) });
  });

  it('follows nextCursor across multiple pages and concatenates them', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: '1' }], hasMore: true, nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [{ id: '2' }], hasMore: true, nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [{ id: '3' }], hasMore: false, nextCursor: null });

    const items = await fetchAllPages(fetchPage);

    expect(items).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined, { deadline: expect.any(Number) });
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'c1', { deadline: expect.any(Number) });
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'c2', { deadline: expect.any(Number) });
  });

  it('stops if hasMore is true but nextCursor is missing, rather than looping forever', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ items: [{ id: '1' }], hasMore: true, nextCursor: null });

    const items = await fetchAllPages(fetchPage);

    expect(items).toEqual([{ id: '1' }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('never hangs on a pathological always-hasMore response — bounded by the defensive ceiling', async () => {
    const fetchPage = vi.fn().mockImplementation(async (cursor?: string) => ({
      items: [{ id: cursor ?? 'first' }],
      hasMore: true,
      nextCursor: `next-${cursor ?? 0}`,
    }));

    const items = await fetchAllPages(fetchPage);

    expect(items.length).toBeGreaterThan(0);
    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(50);
  });

  it('passes the same deadline object to every round — created once, not per round', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: '1' }], hasMore: true, nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [{ id: '2' }], hasMore: false, nextCursor: null });

    await fetchAllPages(fetchPage);

    const firstDeadline = fetchPage.mock.calls[0]?.[1]?.deadline;
    const secondDeadline = fetchPage.mock.calls[1]?.[1]?.deadline;
    expect(firstDeadline).toBeTypeOf('number');
    expect(secondDeadline).toBe(firstDeadline);
  });

  it('stops looping and throws once the shared deadline has passed, rather than returning a partial list', async () => {
    let round = 0;
    const fetchPage = vi.fn().mockImplementation(async () => {
      round += 1;
      // Each round "takes" 10s of wall-clock time — past LIST_BUDGET_MS (25s) by round 3.
      vi.advanceTimersByTime(10_000);
      return { items: [{ id: `${round}` }], hasMore: true, nextCursor: `c${round}` };
    });

    await expect(fetchAllPages(fetchPage)).rejects.toMatchObject({ code: 'timeout' });
    // 3 rounds fit before the deadline check on round 4 trips (0s, 10s, 20s elapsed; 30s > 25s).
    expect(fetchPage.mock.calls.length).toBeLessThan(50);
  });
});
