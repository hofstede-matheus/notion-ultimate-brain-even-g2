import { describe, it, expect } from 'vitest'
import { resolveFilter, TASK_VIEWS } from '../views'
import type { TenantDb } from '../tenant'

const baseDb: TenantDb = {
  tasks: 'tasks-id',
  notes: 'notes-id',
  projects: 'projects-id',
  tags: 'tags-id',
}

function view(path: string) {
  const v = TASK_VIEWS.find((v) => v.path === path)
  if (!v) throw new Error(`view ${path} not found`)
  return v
}

describe('resolveFilter', () => {
  it('returns a static object filter unchanged', () => {
    const today = view('today')
    expect(resolveFilter(today, baseDb)).toBe(today.filter)
  })

  it('invokes a function filter with the tenant db and injects the exclude clause', () => {
    const filter = resolveFilter(view('next-7-days'), {
      ...baseDb,
      excludeProjectId: 'proj-x',
    })
    expect(filter.and).toContainEqual({
      property: 'Project',
      relation: { does_not_contain: 'proj-x' },
    })
  })

  it('omits the exclude clause when excludeProjectId is unset', () => {
    const filter = resolveFilter(view('next-7-days'), baseDb)
    const hasExclude = filter.and.some(
      (c: any) => c.property === 'Project' && c.relation?.does_not_contain
    )
    expect(hasExclude).toBe(false)
  })
})
