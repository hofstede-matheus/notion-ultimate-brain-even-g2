import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';
import type { NotionFilter } from './views';

// ---------------------------------------------------------------------------
// Filter translation
//
// The VIEWS tables below use a richer filter grammar than the public
// `databases.query` endpoint we call here accepts: relative date keywords
// ("today"/"tomorrow"/"one_week_from_now") instead of ISO dates, and
// array-valued select equals/does_not_equal instead of single values.
// translateFilter() rewrites that grammar into valid public-API filters,
// flattening nested and/or groups it introduces back into their parent so we
// stay within Notion's two-level nesting limit.
// ---------------------------------------------------------------------------

/**
 * ISO calendar date (YYYY-MM-DD) `offsetDays` from today, as seen in the
 * given IANA timezone. Uses TZDate + date-fns calendar-day arithmetic
 * (DST-safe). An unknown/invalid zone falls back to UTC.
 *
 * Resolving in the caller's zone (rather than UTC) keeps "today"/"tomorrow"
 * aligned with the user's local calendar day near local midnight.
 */
function resolveTimeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function localDateISO(offsetDays: number, timeZone: string): string {
  const zone = resolveTimeZone(timeZone);
  return format(addDays(new TZDate(new Date(), zone), offsetDays), 'yyyy-MM-dd');
}

const RELATIVE_DATE_OFFSETS: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  one_week_from_now: 7,
};

function flattenBool(kind: 'and' | 'or', children: NotionFilter[]): NotionFilter {
  const merged: NotionFilter[] = [];
  for (const child of children) {
    const group = child[kind];
    if (group) merged.push(...group);
    else merged.push(child);
  }
  return { [kind]: merged };
}

export function translateFilter(node: NotionFilter, timeZone = 'UTC'): NotionFilter {
  if (node.and)
    return flattenBool(
      'and',
      node.and.map((c) => translateFilter(c, timeZone)),
    );
  if (node.or)
    return flattenBool(
      'or',
      node.or.map((c) => translateFilter(c, timeZone)),
    );

  const { property } = node;

  if (node.select) {
    const [op, value] = Object.entries(node.select)[0] as [string, string | string[]];
    if (Array.isArray(value)) {
      const parts: NotionFilter[] = value.map((v) => ({ property, select: { [op]: v } }));
      return op === 'equals' ? { or: parts } : { and: parts };
    }
    return node;
  }

  if (node.date) {
    const [op, value] = Object.entries(node.date)[0] as [string, string];
    const offset = RELATIVE_DATE_OFFSETS[value];
    if (offset !== undefined) {
      return { property, date: { [op]: localDateISO(offset, timeZone) } };
    }
    return node;
  }

  return node;
}
