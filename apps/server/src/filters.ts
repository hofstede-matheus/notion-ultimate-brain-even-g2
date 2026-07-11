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

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const RELATIVE_DATE_KEYWORDS: Record<string, () => string> = {
  today: todayISO,
  tomorrow: () => addDaysISO(1),
  one_week_from_now: () => addDaysISO(7),
}

function flattenBool(kind: 'and' | 'or', children: any[]): any {
  const merged: any[] = []
  for (const child of children) {
    if (child[kind]) merged.push(...child[kind])
    else merged.push(child)
  }
  return { [kind]: merged }
}

export function translateFilter(node: any): any {
  if (node.and) return flattenBool('and', node.and.map(translateFilter))
  if (node.or) return flattenBool('or', node.or.map(translateFilter))

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
    if (typeof value === 'string' && value in RELATIVE_DATE_KEYWORDS) {
      return { property, date: { [op]: RELATIVE_DATE_KEYWORDS[value]() } }
    }
    return node
  }

  return node
}
