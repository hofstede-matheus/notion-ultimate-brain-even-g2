import { describe, expect, it } from 'vitest';
import { TAG_TYPE_AREA, TAG_TYPE_ENTITY, TAG_TYPE_RESOURCE, TAG_VIEWS, TASK_VIEWS } from '../views';

describe('TASK_VIEWS', () => {
  it('defines a static filter for every task view', () => {
    for (const view of TASK_VIEWS) {
      expect(view.filter).toBeDefined();
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
