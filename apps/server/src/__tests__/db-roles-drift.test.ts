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
 */

function collectFilterProperties(filter: ViewConfig['filter']): string[] {
  if (!filter) return [];
  const names: string[] = [];
  if (filter.property) names.push(filter.property);
  for (const clause of filter.and ?? []) names.push(...collectFilterProperties(clause));
  for (const clause of filter.or ?? []) names.push(...collectFilterProperties(clause));
  return names;
}

function collectViewProperties(views: ViewConfig[]): Set<string> {
  const names = new Set<string>();
  for (const view of views) {
    for (const name of collectFilterProperties(view.filter)) names.add(name);
    for (const sort of view.sorts ?? []) names.add(sort.property);
  }
  return names;
}

describe('ROLE_REQUIREMENTS stays in sync with views.ts', () => {
  const cases: [string, keyof typeof ROLE_REQUIREMENTS, ViewConfig[]][] = [
    ['tasks', 'tasks', TASK_VIEWS],
    ['notes', 'notes', NOTE_VIEWS],
    ['projects', 'projects', PROJECT_VIEWS],
    ['tags', 'tags', TAG_VIEWS],
  ];

  for (const [label, role, views] of cases) {
    it(`covers every property ${label} views filter or sort by`, () => {
      const required = new Set(ROLE_REQUIREMENTS[role].flatMap((r) => r.names));
      const used = collectViewProperties(views);
      const uncovered = [...used].filter((name) => !required.has(name));
      expect(uncovered).toEqual([]);
    });
  }
});
