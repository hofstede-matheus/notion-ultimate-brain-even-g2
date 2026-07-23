/**
 * fetchAllPages — the client-side cursor loop that replaces the old
 * server-side page_size cap. See apps/server/src/routes.ts's header comment
 * ("pagination loops... belong in the glasses app").
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from '../../../glasses/modules/_shared/pagination';

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
    expect(fetchPage).toHaveBeenCalledWith(undefined);
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
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'c1');
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'c2');
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
});
