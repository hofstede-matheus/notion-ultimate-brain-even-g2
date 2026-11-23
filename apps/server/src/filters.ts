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

/**
 * `node` without any leaf clause on a property in `names`, or `undefined` when nothing is left.
 * An `and`/`or` group that loses every child is dropped with it. Used to leave an optional
 * property (ROLE_REQUIREMENTS `optional`) out of a query for a database that doesn't have it —
 * see routes.ts's filterFor.
 */
export function omitProperties(node: NotionFilter, names: Set<string>): NotionFilter | undefined {
  for (const kind of ['and', 'or'] as const) {
    const group = node[kind];
    if (!group) continue;
    const kept = group
      .map((child) => omitProperties(child, names))
      .filter((child): child is NotionFilter => child !== undefined);
    return kept.length > 0 ? { [kind]: kept } : undefined;
  }
  return node.property !== undefined && names.has(node.property) ? undefined : node;
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
