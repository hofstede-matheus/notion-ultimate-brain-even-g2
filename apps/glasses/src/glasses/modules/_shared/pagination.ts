import type { PagedResult } from '../../../api';

/**
 * Hard ceiling on how many server round-trips fetchAllPages will make for a
 * single list. Purely a defensive guard against a malformed/looping API
 * response (e.g. a cursor that never advances) — real lists are expected to
 * finish well before this via hasMore going false.
 */
const MAX_FETCH_ROUNDS = 50;

/**
 * Loops a cursor-paginated fetcher until Notion reports no more results,
 * returning the full concatenated list. The server stays a thin proxy
 * (page_size capped at Notion's own 100-per-request max) — following the
 * cursor across requests is exactly the "pagination loop belongs in the
 * glasses app" work described in apps/server/src/routes.ts's header comment.
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;

  for (let round = 0; round < MAX_FETCH_ROUNDS; round++) {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return items;
}
