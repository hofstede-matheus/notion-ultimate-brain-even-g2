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
const notion = new Client({ auth: NOTION_API_KEY })

if (!NOTION_API_KEY) {
  console.error('Missing NOTION_API_KEY in environment')
  process.exit(1)
}
if (!NOTION_TASKS_DB) {
  console.error('Missing NOTION_TASKS_DB in environment')
  process.exit(1)
}

console.log(`[notion-ultimate-brain-server] Notion DB: ${NOTION_TASKS_DB}`)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TaskResult {
  id: string
  name: string
  dueDate?: string
}

/** Extract task fields from a Notion page */
function pageToTask(page: any): TaskResult {
  const props = page.properties
  const titleProp = props['Name'] || props['Task'] || props['Title']
  const name =
    titleProp?.title?.[0]?.plain_text ?? titleProp?.rich_text?.[0]?.plain_text ?? '(untitled)'

  const dueDate = props['Due']?.date?.start ?? undefined

  return { id: page.id, name, dueDate }
}

/** Get today's date as YYYY-MM-DD in local timezone */
function todayISO(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express()
app.use(cors())

// ---------------------------------------------------------------------------
// GET /api/tasks/today
// Tasks with Due ≤ today AND Status != Done
// ---------------------------------------------------------------------------
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

app.get('/api/tasks/today', async (_req, res) => {
  try {
    const today = todayISO()
    const response = await notion.databases.query({
      database_id: NOTION_TASKS_DB,
      filter: {
        and: [
          {
            property: 'Due',
            date: { on_or_before: today },
          },
          {
            property: 'Status',
            status: { does_not_equal: 'Done' },
          },
        ],
      },
      sorts: [{ property: 'Due', direction: 'ascending' }],
      page_size: 50,
    })

    const tasks = response.results.map(pageToTask)
    res.json({ tasks })
  } catch (err: any) {
    console.error('[server] /api/tasks/today error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/tasks/inbox
// Tasks with NO project assigned AND Status != Done
// ---------------------------------------------------------------------------
app.get('/api/tasks/inbox', async (_req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: NOTION_TASKS_DB,
      filter: {
        and: [
          {
            property: 'Project',
            relation: { is_empty: true },
          },
          {
            property: 'Status',
            status: { does_not_equal: 'Done' },
          },
        ],
      },
      sorts: [{ property: 'Name', direction: 'ascending' }],
      page_size: 50,
    })

    const tasks = response.results.map(pageToTask)
    res.json({ tasks })
  } catch (err: any) {
    console.error('[server] /api/tasks/inbox error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

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
