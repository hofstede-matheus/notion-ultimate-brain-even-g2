import { describe, expect, it } from 'vitest';
import {
  PROJECT_STATUS_DOING,
  PROJECT_STATUS_DONE,
  PROJECT_STATUS_ON_HOLD,
  PROJECT_STATUS_ONGOING,
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_PLANNED,
  PROJECT_VIEWS,
  TAG_TYPE_AREA,
  TAG_TYPE_ENTITY,
  TAG_TYPE_RESOURCE,
  TAG_VIEWS,
  TASK_VIEWS,
} from '../views';

describe('TASK_VIEWS', () => {
  it('defines a static filter for every task view', () => {
    for (const view of TASK_VIEWS) {
      expect(view.filter).toBeDefined();
    }
  });
});

describe('PROJECT_VIEWS status filters', () => {
  /**
   * Spelled out rather than derived from the constants: this is the copy of
   * the real Projects `Status` options, so a typo in a constant fails here
   * instead of being mirrored by the assertion meant to catch it.
   */
  it('pins the option literals to the ones the Projects database actually has', () => {
    expect([...PROJECT_STATUS_OPTIONS]).toEqual(['Planned', 'On Hold', 'Doing', 'Ongoing', 'Done']);
  });

  /**
   * "All" spans every status but still hides archived projects — `archived`
   * has its own view, and the picker's All row would otherwise offer finished
   * work as a destination.
   */
  it('excludes archived projects from the all view, without filtering by status', () => {
    const view = PROJECT_VIEWS.find((v) => v.path === 'all');
    expect(view?.filter).toEqual({ property: 'Archived', checkbox: { equals: false } });
  });

  it('keeps archived as the only view that opts into archived projects', () => {
    const archived = PROJECT_VIEWS.find((v) => v.path === 'archived');
    expect(archived?.filter).toEqual({ property: 'Archived', checkbox: { equals: true } });

    const others = PROJECT_VIEWS.filter((v) => v.path !== 'archived');
    for (const view of others) {
      const clauses = view.filter?.and ?? (view.filter ? [view.filter] : []);
      expect(clauses).toContainEqual({ property: 'Archived', checkbox: { equals: false } });
    }
  });

  it('filters each status view by its real option name', () => {
    const expectations = [
      ['doing', PROJECT_STATUS_DOING],
      ['ongoing', PROJECT_STATUS_ONGOING],
      ['planned', PROJECT_STATUS_PLANNED],
      ['on-hold', PROJECT_STATUS_ON_HOLD],
      ['done', PROJECT_STATUS_DONE],
    ] as const;

    for (const [path, option] of expectations) {
      const view = PROJECT_VIEWS.find((v) => v.path === path);
      expect(view).toBeDefined();
      expect(view?.filter).toMatchObject({
        and: expect.arrayContaining([
          { property: 'Archived', checkbox: { equals: false } },
          { property: 'Status', status: { equals: option } },
        ]),
      });
    }
  });

  /**
   * The one that would have caught `On hold`: a group label or a miscased
   * option is accepted by the Notion API and silently matches nothing, so an
   * unknown literal can only be spotted against the option list itself.
   */
  it('never filters by a status string outside the real option set', () => {
    const statusEquals = PROJECT_VIEWS.flatMap((view) =>
      (view.filter?.and ?? []).flatMap((clause) =>
        clause.property === 'Status' && clause.status?.equals ? [clause.status.equals] : [],
      ),
    );

    expect(statusEquals.length).toBeGreaterThan(0);
    for (const value of statusEquals) {
      expect(PROJECT_STATUS_OPTIONS).toContain(value);
    }
  });
});

describe('TAG_VIEWS types/*', () => {
  it('filters by the Type status property rather than aliasing a-z', () => {
    const azFilter = TAG_VIEWS.find((v) => v.path === 'a-z')?.filter;
    const areaFilter = TAG_VIEWS.find((v) => v.path === 'types/area')?.filter;
    expect(areaFilter).toBeDefined();
    expect(areaFilter).not.toEqual(azFilter);
  });

  it('has one static view per real Type option (Area/Resource/Entity)', () => {
    const expectations = [
      ['types/area', TAG_TYPE_AREA],
      ['types/resource', TAG_TYPE_RESOURCE],
      ['types/entity', TAG_TYPE_ENTITY],
    ] as const;

    for (const [path, option] of expectations) {
      const view = TAG_VIEWS.find((v) => v.path === path);
      expect(view).toBeDefined();
      expect(view?.filter).toMatchObject({
        and: expect.arrayContaining([{ property: 'Type', status: { equals: option } }]),
      });
    }
  });
});
