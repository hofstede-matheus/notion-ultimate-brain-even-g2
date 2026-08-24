import { describe, expect, it } from 'vitest';
import { evaluateRoles } from '../db-roles';

// Property-type maps taken from the real Notion workspace involved in this incident (fetched
// read-only via the Notion API during investigation) — not synthetic fixtures.
const REAL_UB_PROJECTS_DB = {
  Name: 'title',
  Archived: 'checkbox',
  Status: 'status',
  Meta: 'formula',
  'Latest Activity': 'formula',
  'Target Deadline': 'date',
  Created: 'created_time',
  Edited: 'last_edited_time',
};

// One of the three decoy "Projects" databases that caused this incident — Notion's stock
// project-management template, sharing the "Projects" title but not the schema.
const STOCK_TEMPLATE_PROJECTS_DB = {
  'Project name': 'title',
  Owner: 'people',
  Teams: 'relation',
  Status: 'status',
  Priority: 'select',
  Dates: 'date',
  'Launch date': 'date',
  'Blocked By': 'relation',
  'Is Blocking': 'relation',
  Summary: 'rich_text',
  Tag: 'relation',
  Tasks: 'relation',
  Completion: 'formula',
};

describe('evaluateRoles', () => {
  it('fits the real Ultimate Brain Projects schema to the projects role', () => {
    const { roles } = evaluateRoles(REAL_UB_PROJECTS_DB);
    expect(roles).toContain('projects');
  });

  it('rejects the stock-template decoy, naming the properties it lacks', () => {
    const { roles, unfit } = evaluateRoles(STOCK_TEMPLATE_PROJECTS_DB);
    expect(roles).not.toContain('projects');
    expect(unfit?.projects?.missing).toEqual(
      expect.arrayContaining(['Name', 'Archived', 'Meta', 'Latest Activity']),
    );
  });

  it('rejects a property present under the right name but the wrong type', () => {
    // Tags' Type must be a status property (CLAUDE.md gotcha) — a select with the same name
    // must not satisfy the tags role.
    const { roles, unfit } = evaluateRoles({
      Name: 'title',
      Archived: 'checkbox',
      Favorite: 'checkbox',
      Type: 'select',
    });
    expect(roles).not.toContain('tags');
    expect(unfit?.tags?.missing).toContain('Type');
  });

  it('accepts a sort-only property regardless of its underlying type', () => {
    // Meta and Latest Activity are formulas in the real DB but are only ever sorted on, never
    // filtered or read back — evaluateRoles must not pin a type for them.
    const properties = {
      Name: 'title',
      Archived: 'checkbox',
      Status: 'status',
      Meta: 'rollup', // a different type than the real DB's "formula" — still fine, presence-only
      'Latest Activity': 'formula',
      'Target Deadline': 'date',
    };
    expect(evaluateRoles(properties).roles).toContain('projects');
  });

  it('returns {} (unknown), never "fits nothing", when properties is undefined', () => {
    expect(evaluateRoles(undefined)).toEqual({});
  });

  it('names every missing property, not a sample of them', () => {
    // A database with no properties at all is missing everything its role needs — the settings
    // picker shows this list verbatim, so a user renaming properties in Notion sees all of them
    // at once rather than three at a time.
    const { unfit } = evaluateRoles({});
    expect(unfit?.notes?.missing).toEqual([
      'Name',
      'Archived',
      'Favorite',
      'Type',
      'URL',
      'Tag',
      'Project',
      'Content',
      'Updated',
      'Note Date',
    ]);
  });
});
