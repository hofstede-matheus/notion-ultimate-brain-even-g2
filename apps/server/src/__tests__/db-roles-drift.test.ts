import { ROLE_REQUIREMENTS } from '@notion-ub/contracts';
import { describe, expect, it } from 'vitest';
import { NOTE_VIEWS, PROJECT_VIEWS, TAG_VIEWS, TASK_VIEWS, type ViewConfig } from '../views';

/**
 * Guards against the failure mode behind this incident: a view in views.ts filters or sorts
 * by a property name that @notion-ub/contracts's ROLE_REQUIREMENTS doesn't know about, so the
 * settings picker's fit check silently passes a database that can't actually serve the view.
 * Fails on purpose when a new filter/sort names a property the table doesn't list — the fix
 * is to add that property to ROLE_REQUIREMENTS, not to loosen this test. Mirrors how
 * views.test.ts pins PROJECT_STATUS_OPTIONS against the real Status options.
 *
 * Checked per view, not just per role (see issue #40): ROLE_REQUIREMENTS's `views` field claims
 * which specific views break without a property, and the settings picker's warning names those
 * views verbatim. A per-role check alone can't catch a `views` entry naming the wrong view (or
 * missing one) as long as the property still shows up *somewhere* in the role — only a per-view
 * comparison can, in both directions: a view referencing a property no requirement claims for
 * it, and a requirement claiming a view that doesn't actually reference it.
 */

function collectFilterProperties(filter: ViewConfig['filter']): string[] {
  if (!filter) return [];
  const names: string[] = [];
  if (filter.property) names.push(filter.property);
  for (const clause of filter.and ?? []) names.push(...collectFilterProperties(clause));
  for (const clause of filter.or ?? []) names.push(...collectFilterProperties(clause));
  return names;
}

/** path -> sorted, deduped property names that view's filter/sort actually reference. */
function propertiesUsedByView(views: ViewConfig[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const view of views) {
    const names = new Set(collectFilterProperties(view.filter));
    for (const sort of view.sorts ?? []) names.add(sort.property);
    map[view.path] = [...names].sort();
  }
  return map;
}

/** path -> sorted, deduped property names ROLE_REQUIREMENTS claims that view needs. Uses
 *  `names[0]` as the literal property name — the convention db-roles-requirements.ts documents
 *  and relies on: views.ts always hardcodes one literal name per filter/sort clause. */
function propertiesClaimedByView(
  role: keyof typeof ROLE_REQUIREMENTS,
  paths: string[],
): Record<string, string[]> {
  const map: Record<string, Set<string>> = Object.fromEntries(
    paths.map((path) => [path, new Set()]),
  );
  for (const req of ROLE_REQUIREMENTS[role]) {
    for (const path of req.views) map[path]?.add(req.names[0]);
  }
  return Object.fromEntries(Object.entries(map).map(([path, names]) => [path, [...names].sort()]));
}

describe('ROLE_REQUIREMENTS stays in sync with views.ts, view by view', () => {
  const cases: [string, keyof typeof ROLE_REQUIREMENTS, ViewConfig[]][] = [
    ['tasks', 'tasks', TASK_VIEWS],
    ['notes', 'notes', NOTE_VIEWS],
    ['projects', 'projects', PROJECT_VIEWS],
    ['tags', 'tags', TAG_VIEWS],
  ];

  for (const [label, role, views] of cases) {
    it(`claims exactly the properties each ${label} view filters or sorts by`, () => {
      const used = propertiesUsedByView(views);
      const claimed = propertiesClaimedByView(role, Object.keys(used));
      expect(claimed).toEqual(used);
    });
  }
});
