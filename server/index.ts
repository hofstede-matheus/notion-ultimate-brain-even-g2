import dotenv from 'dotenv'
dotenv.config({ override: true })
import express from 'express'
import cors from 'cors'
import { Client } from '@notionhq/client'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3210
const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_TASKS_DB = process.env.NOTION_TASKS_DB!
const NOTION_NOTES_DB = process.env.NOTION_NOTES_DB!
const NOTION_PROJECTS_DB = process.env.NOTION_PROJECTS_DB!
const NOTION_TAGS_DB = process.env.NOTION_TAGS_DB!
const notion = new Client({ auth: NOTION_API_KEY })

if (!NOTION_API_KEY) {
  console.error('Missing NOTION_API_KEY in environment')
  process.exit(1)
}
for (const [key, value] of Object.entries({
  NOTION_TASKS_DB,
  NOTION_NOTES_DB,
  NOTION_PROJECTS_DB,
  NOTION_TAGS_DB,
})) {
  if (!value) {
    console.error(`Missing ${key} in environment`)
    process.exit(1)
  }
}

console.log(
  `[notion-ultimate-brain-server] Notion DBs: tasks=${NOTION_TASKS_DB} notes=${NOTION_NOTES_DB} projects=${NOTION_PROJECTS_DB} tags=${NOTION_TAGS_DB}`
)

// ---------------------------------------------------------------------------
// Page → result helpers
// ---------------------------------------------------------------------------

interface TaskResult {
  id: string
  name: string
  dueDate?: string
}

interface NoteResult {
  id: string
  name: string
  icon?: string
  lastEdited?: string
}

interface ProjectResult {
  id: string
  name: string
  status?: string
}

interface TagResult {
  id: string
  name: string
}

function pageTitle(page: any): string {
  const props = page.properties
  const titleProp = props['Name'] || props['Task'] || props['Title']
  return titleProp?.title?.[0]?.plain_text ?? titleProp?.rich_text?.[0]?.plain_text ?? '(untitled)'
}

function pageToTask(page: any): TaskResult {
  const dueDate = page.properties['Due']?.date?.start ?? undefined
  return { id: page.id, name: pageTitle(page), dueDate }
}

function pageToNote(page: any): NoteResult {
  const icon = page.icon?.emoji ?? page.icon?.external?.url ?? page.icon?.file?.url ?? undefined
  const lastEdited = page.last_edited_time ?? undefined
  return { id: page.id, name: pageTitle(page), icon, lastEdited }
}

function pageToProject(page: any): ProjectResult {
  const status = page.properties['Status']?.status?.name ?? undefined
  return { id: page.id, name: pageTitle(page), status }
}

function pageToTag(page: any): TagResult {
  return { id: page.id, name: pageTitle(page) }
}

// ---------------------------------------------------------------------------
// Filter translation
//
// PLAN.md's "Appendix: Resolved View Filters" was captured from Notion's
// internal Views API (`POST /v1/views/{id}`), which accepts a richer filter
// grammar than the public `databases.query` endpoint we call here: relative
// date keywords ("today"/"tomorrow"/"one_week_from_now") instead of ISO
// dates, array-valued select equals/does_not_equal instead of single values,
// and bare `formula: { equals }` instead of the type-specific
// `formula: { checkbox: { equals } }` shape. translateFilter() rewrites the
// appendix JSON (kept verbatim in the VIEWS tables below, so it's easy to
// diff against PLAN.md) into valid public-API filters, flattening nested
// and/or groups it introduces back into their parent so we stay within
// Notion's two-level nesting limit.
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

function translateFilter(node: any): any {
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

  if (node.formula) {
    const [op, value] = Object.entries(node.formula)[0] as [string, any]
    return { property, formula: { checkbox: { [op]: value } } }
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

interface ViewConfig {
  path: string
  filter?: any
  sorts?: any[]
}

function registerViews(
  domain: string,
  databaseId: string,
  views: ViewConfig[],
  resultKey: string,
  toResult: (page: any) => any
) {
  for (const view of views) {
    app.get(`/api/${domain}/${view.path}`, async (_req, res) => {
      try {
        const response = await notion.databases.query({
          database_id: databaseId,
          filter: view.filter ? translateFilter(view.filter) : undefined,
          sorts: view.sorts,
          page_size: 50,
        })
        res.json({ [resultKey]: response.results.map(toResult) })
      } catch (err: any) {
        console.error(`[server] /api/${domain}/${view.path} error:`, err.message)
        res.status(500).json({ error: err.message })
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Tasks views (Appendix → Tasks)
// ---------------------------------------------------------------------------

const TASK_VIEWS: ViewConfig[] = [
  {
    path: 'inbox',
    filter: {
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { or: [{ property: 'Project', relation: { is_empty: true } }] },
        {
          and: [
            { property: 'Smart List', select: { does_not_equal: ['Do Next', 'Delegated', 'Someday'] } },
            { property: 'Snooze', date: { is_empty: true } },
          ],
        },
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
        { property: 'Project', relation: { does_not_contain: '2063c6e7-dd22-808b-9e0d-e6ee814d9442' } },
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
        { property: 'Project', relation: { does_not_contain: '2063c6e7-dd22-808b-9e0d-e6ee814d9442' } },
      ],
    },
    sorts: [
      { property: 'Due', direction: 'ascending' },
      { property: 'Project', direction: 'ascending' },
      { property: 'Sub-Task Sorter', direction: 'ascending' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Notes views (Appendix → Notes)
// ---------------------------------------------------------------------------

const NOTE_TYPE_EXCLUDE_STANDARD = ['Journal', 'Meeting', 'Web Clip', 'Daily']
const NOTE_URL_OR_VOICE: ViewConfig['filter'] = {
  or: [
    { property: 'URL', url: { is_empty: true } },
    { property: 'Type', select: { equals: 'Voice Note' } },
  ],
}

const NOTE_VIEWS: ViewConfig[] = [
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
// Projects views (Appendix → Projects)
// ---------------------------------------------------------------------------

const PROJECT_VIEWS: ViewConfig[] = [
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
// Tags views (Appendix → Tags)
// ---------------------------------------------------------------------------

const TAG_VIEWS: ViewConfig[] = [
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

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express()
app.use(cors())

// ---------------------------------------------------------------------------
// POST /api/logs
// Browser-side console messages forwarded from the webview so they show up
// in the same terminal as the server logs when running `npm run dev:all`.
// Body: { level: string, line: string }
// ---------------------------------------------------------------------------
app.post('/api/logs', express.json(), (req, res) => {
  const { level, line } = req.body ?? {}
  if (typeof line !== 'string') {
    res.status(400).json({ error: 'Missing "line" in request body' })
    return
  }
  const tag = (typeof level === 'string' && level.trim()) || 'log'
  console.log(`[browser:${tag}] ${line}`)
  res.json({ ok: true })
})

registerViews('tasks', NOTION_TASKS_DB, TASK_VIEWS, 'tasks', pageToTask)
registerViews('notes', NOTION_NOTES_DB, NOTE_VIEWS, 'notes', pageToNote)
registerViews('projects', NOTION_PROJECTS_DB, PROJECT_VIEWS, 'projects', pageToProject)
registerViews('tags', NOTION_TAGS_DB, TAG_VIEWS, 'tags', pageToTag)

// ---------------------------------------------------------------------------
// POST /api/tasks
// Create a new task in the Notion Tasks database
// Body: { name: string }
// ---------------------------------------------------------------------------
app.post('/api/tasks', express.json(), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing "name" in request body' })
      return
    }

    const page = await notion.pages.create({
      parent: { database_id: NOTION_TASKS_DB },
      properties: {
        Name: {
          title: [{ text: { content: name } }],
        },
      },
    })

    res.json({ id: page.id, name })
  } catch (err: any) {
    console.error('[server] /api/tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[notion-ultimate-brain-server] Listening on http://localhost:${PORT}`)
})
