import type { PagedResult, RequestOptions } from '../../../api';
import { ApiError } from '../../../api';
import { CODE_TIMEOUT } from '../../../http/errors';

/**
 * Hard ceiling on how many server round-trips fetchAllPages will make for a
 * single list. Purely a defensive guard against a malformed/looping API
 * response (e.g. a cursor that never advances) — real lists are expected to
 * finish well before this via hasMore going false.
 */
const MAX_FETCH_ROUNDS = 50;

/**
 * Wall-clock budget shared across every round of one list load — not just per-request retry
 * budget. Without this, a transient failure partway through a long list could retry on every
 * one of up to MAX_FETCH_ROUNDS rounds, at up to ~6s per attempt: unbounded in the worst case.
 * One deadline, created once per call (not per round), passed to every fetchPage call so a
 * retry inside any single round also respects it — see http/client.ts's shouldRetry.
 * Matches glasses/bridge-queue.ts's existing SETTLE_WAIT_CAP_MS, keeping the app's
 * pathological-failure timescales consistent.
 */
const LIST_BUDGET_MS = 25_000;

/**
 * Loops a cursor-paginated fetcher until Notion reports no more results,
 * returning the full concatenated list. The server stays a thin proxy
 * (page_size capped at Notion's own 100-per-request max) — following the
 * cursor across requests is exactly the "pagination loop belongs in the
 * glasses app" work described in apps/server/src/routes.ts's header comment.
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string, opts?: RequestOptions) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  const deadline = Date.now() + LIST_BUDGET_MS;

  for (let round = 0; round < MAX_FETCH_ROUNDS; round++) {
    if (Date.now() >= deadline) {
      throw new ApiError('List took too long to load', 0, CODE_TIMEOUT);
    }
    const page = await fetchPage(cursor, { deadline });
    items.push(...page.items);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return items;
}
