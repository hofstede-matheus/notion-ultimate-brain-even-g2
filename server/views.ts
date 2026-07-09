import type { TenantDb } from './tenant'

export interface ViewConfig {
  path: string
  filter?: any | ((db: TenantDb) => any)
  sorts?: any[]
}

/** Resolve a ViewConfig's filter against the current tenant's db config. */
export function resolveFilter(view: ViewConfig, db: TenantDb): any {
  return typeof view.filter === 'function' ? view.filter(db) : view.filter
}

// ---------------------------------------------------------------------------
// Tasks views
// ---------------------------------------------------------------------------

export const TASK_VIEWS: ViewConfig[] = [
  {
    path: 'inbox',
    filter: {
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { or: [{ property: 'Project', relation: { is_empty: true } }] },
        { property: 'Snooze', date: { is_empty: true } },
      ],
    },
    sorts: [{ property: 'Created', direction: 'ascending' }],
  },
  {
    path: 'today',
    filter: {
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Due', date: { on_or_before: 'today' } },
      ],
    },
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Name', direction: 'ascending' },
    ],
  },
  {
    path: 'next-7-days',
    filter: (db: TenantDb) => ({
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Due', date: { on_or_before: 'one_week_from_now' } },
        ...(db.excludeProjectId
          ? [{ property: 'Project', relation: { does_not_contain: db.excludeProjectId } }]
          : []),
      ],
    }),
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Sub-Task Sorter', direction: 'ascending' },
    ],
  },
  {
    path: 'tomorrow',
    filter: (db: TenantDb) => ({
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Due', date: { equals: 'tomorrow' } },
        ...(db.excludeProjectId
          ? [{ property: 'Project', relation: { does_not_contain: db.excludeProjectId } }]
          : []),
      ],
    }),
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Sub-Task Sorter', direction: 'ascending' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Notes views
// ---------------------------------------------------------------------------

const NOTE_TYPE_EXCLUDE_STANDARD = ['Journal', 'Meeting', 'Web Clip', 'Daily']
const NOTE_URL_OR_VOICE: ViewConfig['filter'] = {
  or: [
    { property: 'URL', url: { is_empty: true } },
    { property: 'Type', select: { equals: 'Voice Note' } },
  ],
}

export const NOTE_VIEWS: ViewConfig[] = [
  {
    path: 'inbox',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        {
          and: [
            { property: 'Tag', relation: { is_empty: true } },
            { property: 'Project', relation: { is_empty: true } },
          ],
        },
        { property: 'Type', select: { does_not_equal: ['Daily', 'Book', 'Recipe', 'Journal', 'Meeting'] } },
        { property: 'Content', relation: { is_empty: true } },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'favorites',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Favorite', checkbox: { equals: true } },
      ],
    },
  },
  {
    path: 'by-tag',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { does_not_equal: NOTE_TYPE_EXCLUDE_STANDARD } },
        NOTE_URL_OR_VOICE,
        { property: 'Content', relation: { is_empty: true } },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'notes',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { does_not_equal: NOTE_TYPE_EXCLUDE_STANDARD } },
        NOTE_URL_OR_VOICE,
        { property: 'Content', relation: { is_empty: true } },
        {
          or: [
            { property: 'Project', relation: { is_not_empty: true } },
            { property: 'Tag', relation: { is_not_empty: true } },
          ],
        },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'meetings',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { equals: 'Meeting' } },
      ],
    },
    sorts: [{ property: 'Note Date', direction: 'descending' }],
  },
  {
    path: 'by-project',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { does_not_equal: NOTE_TYPE_EXCLUDE_STANDARD } },
        NOTE_URL_OR_VOICE,
        { property: 'Content', relation: { is_empty: true } },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'clips',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { does_not_equal: 'Voice Note' } },
        {
          or: [
            { property: 'URL', url: { is_not_empty: true } },
            { property: 'Type', select: { equals: 'Web Clip' } },
          ],
        },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'voice',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { equals: 'Voice Note' } },
      ],
    },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
  {
    path: 'journal',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', select: { equals: ['Daily', 'Journal'] } },
      ],
    },
    sorts: [{ property: 'Note Date', direction: 'descending' }],
  },
  {
    path: 'all',
    filter: { property: 'Archived', checkbox: { equals: false } },
    sorts: [{ property: 'Updated', direction: 'descending' }],
  },
]

// ---------------------------------------------------------------------------
// Projects views
// ---------------------------------------------------------------------------

export const PROJECT_VIEWS: ViewConfig[] = [
  {
    path: 'active',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        // "In progress" is a status *group* label, not a real option — the
        // Projects DB's actual options in that group are "Doing"/"Ongoing".
        {
          or: [
            { property: 'Status', status: { equals: 'Doing' } },
            { property: 'Status', status: { equals: 'Ongoing' } },
          ],
        },
      ],
    },
    sorts: [{ property: 'Meta', direction: 'ascending' }],
  },
  {
    path: 'planned',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Status', status: { equals: 'Planned' } },
      ],
    },
    sorts: [{ property: 'Meta', direction: 'ascending' }],
  },
  {
    path: 'board',
    filter: { property: 'Archived', checkbox: { equals: false } },
    sorts: [
      { property: 'Target Deadline', direction: 'ascending' },
      { property: 'Latest Activity', direction: 'descending' },
    ],
  },
  {
    path: 'archived',
    filter: { property: 'Archived', checkbox: { equals: true } },
    sorts: [{ property: 'Latest Activity', direction: 'descending' }],
  },
]

// ---------------------------------------------------------------------------
// Tags views
// ---------------------------------------------------------------------------

export const TAG_VIEWS: ViewConfig[] = [
  {
    path: 'recent',
    filter: { property: 'Archived', checkbox: { equals: false } },
    sorts: [{ property: 'Latest Activity', direction: 'descending' }],
  },
  {
    path: 'favorites',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Favorite', checkbox: { equals: true } },
      ],
    },
  },
  {
    path: 'a-z',
    filter: { property: 'Archived', checkbox: { equals: false } },
    sorts: [{ property: 'Name', direction: 'ascending' }],
  },
  {
    path: 'types',
    filter: { property: 'Archived', checkbox: { equals: false } },
    sorts: [{ property: 'Name', direction: 'ascending' }],
  },
]
