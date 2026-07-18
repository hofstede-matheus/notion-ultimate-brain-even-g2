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
 * given IANA timezone. We format the *current* instant in that zone to get its
 * local calendar day, then shift by whole days via UTC math (DST-safe, since
 * the arithmetic is date-only). An unknown/invalid zone falls back to UTC.
 *
 * Resolving in the caller's zone (rather than UTC) keeps "today"/"tomorrow"
 * aligned with the user's local calendar day near local midnight.
 */
function localDateISO(offsetDays: number, timeZone: string): string {
  let ymd: string
  try {
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  }
  if (offsetDays === 0) return ymd
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().split('T')[0]
}

const RELATIVE_DATE_OFFSETS: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  one_week_from_now: 7,
}

function flattenBool(kind: 'and' | 'or', children: any[]): any {
  const merged: any[] = []
  for (const child of children) {
    if (child[kind]) merged.push(...child[kind])
    else merged.push(child)
  }
  return { [kind]: merged }
}

export function translateFilter(node: any, timeZone = 'UTC'): any {
  if (node.and) return flattenBool('and', node.and.map((c: any) => translateFilter(c, timeZone)))
  if (node.or) return flattenBool('or', node.or.map((c: any) => translateFilter(c, timeZone)))

  const { property } = node

  if (node.select) {
    const [op, value] = Object.entries(node.select)[0] as [string, any]
    if (Array.isArray(value)) {
      const parts = value.map((v) => ({ property, select: { [op]: v } }))
      return op === 'equals' ? { or: parts } : { and: parts }
    }
    return node
  }

  if (node.date) {
    const [op, value] = Object.entries(node.date)[0] as [string, any]
    if (typeof value === 'string' && value in RELATIVE_DATE_OFFSETS) {
      return { property, date: { [op]: localDateISO(RELATIVE_DATE_OFFSETS[value], timeZone) } }
    }
    return node
  }

  return node
}
