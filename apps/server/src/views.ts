/**
 * The subset of the Notion query-filter grammar these view tables use. Covers
 * the boolean groups (and/or) plus the per-property conditions below; relative
 * date keywords and array-valued select equals are rewritten into valid public
 * API filters by translateFilter() before they reach Notion.
 */
export interface NotionFilter {
  property?: string;
  and?: NotionFilter[];
  or?: NotionFilter[];
  relation?: {
    contains?: string;
    does_not_contain?: string;
    is_empty?: boolean;
    is_not_empty?: boolean;
  };
  status?: { equals?: string; does_not_equal?: string };
  date?: { equals?: string; on_or_before?: string; is_empty?: boolean };
  select?: { equals?: string | string[]; does_not_equal?: string | string[] };
  checkbox?: { equals?: boolean };
  url?: { is_empty?: boolean; is_not_empty?: boolean };
}

/** A Notion query sort clause. */
export interface NotionSort {
  property: string;
  direction: 'ascending' | 'descending';
}

export interface ViewConfig {
  path: string;
  filter?: NotionFilter;
  sorts?: NotionSort[];
}

// ---------------------------------------------------------------------------
// Tasks views
// ---------------------------------------------------------------------------

/**
 * Tasks DB `Status` option literals — confirmed against this tenant's actual
 * database. Notion's status filters need the real option name, not a group
 * label (see PROJECT_VIEWS's `active` view below for the same trap on the
 * Projects side): a task's Status is one of several "To Do"-group and
 * "In Progress"-group options in general, but this tenant only uses these two.
 */
export const TASK_STATUS_TODO = 'To Do';
export const TASK_STATUS_DONE = 'Done';

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
    filter: {
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Due', date: { on_or_before: 'one_week_from_now' } },
      ],
    },
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Sub-Task Sorter', direction: 'ascending' },
    ],
  },
  {
    path: 'tomorrow',
    filter: {
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Due', date: { equals: 'tomorrow' } },
      ],
    },
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Sub-Task Sorter', direction: 'ascending' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Notes views
// ---------------------------------------------------------------------------

const NOTE_TYPE_EXCLUDE_STANDARD = ['Journal', 'Meeting', 'Web Clip', 'Daily'];
const NOTE_URL_OR_VOICE: ViewConfig['filter'] = {
  or: [
    { property: 'URL', url: { is_empty: true } },
    { property: 'Type', select: { equals: 'Voice Note' } },
  ],
};

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
        {
          property: 'Type',
          select: { does_not_equal: ['Daily', 'Book', 'Recipe', 'Journal', 'Meeting'] },
        },
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
];

// ---------------------------------------------------------------------------
// Projects views
// ---------------------------------------------------------------------------

export const PROJECT_VIEWS: ViewConfig[] = [
  {
    path: 'doing',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Status', status: { equals: 'Doing' } },
      ],
    },
    sorts: [{ property: 'Meta', direction: 'ascending' }],
  },
  {
    path: 'ongoing',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Status', status: { equals: 'Ongoing' } },
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
    path: 'on-hold',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Status', status: { equals: 'On Hold' } },
      ],
    },
    sorts: [{ property: 'Meta', direction: 'ascending' }],
  },
  {
    path: 'done',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Status', status: { equals: 'Done' } },
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
];

// ---------------------------------------------------------------------------
// Tags views
// ---------------------------------------------------------------------------

/**
 * Tags DB `Type` option literals — confirmed against this tenant's actual
 * database (a `status`-kind property with exactly these three options, no
 * others in use). Same trap as TASK_STATUS_TODO/DONE above: Notion's status
 * filters need the real option name, not a group label.
 */
export const TAG_TYPE_AREA = 'Area';
export const TAG_TYPE_RESOURCE = 'Resource';
export const TAG_TYPE_ENTITY = 'Entity';

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
    path: 'types/area',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', status: { equals: TAG_TYPE_AREA } },
      ],
    },
    sorts: [{ property: 'Name', direction: 'ascending' }],
  },
  {
    path: 'types/resource',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', status: { equals: TAG_TYPE_RESOURCE } },
      ],
    },
    sorts: [{ property: 'Name', direction: 'ascending' }],
  },
  {
    path: 'types/entity',
    filter: {
      and: [
        { property: 'Archived', checkbox: { equals: false } },
        { property: 'Type', status: { equals: TAG_TYPE_ENTITY } },
      ],
    },
    sorts: [{ property: 'Name', direction: 'ascending' }],
  },
];
