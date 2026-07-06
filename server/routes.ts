import { config } from './config'
import { notion } from './notion-client'
import { pageTitle, pageToTask, pageToNote, pageToProject, pageToTag } from './mappers'
import { translateFilter } from './filters'
import { ViewConfig, TASK_VIEWS, NOTE_VIEWS, PROJECT_VIEWS, TAG_VIEWS } from './views'

export interface RouteContext {
  params: Record<string, string>
  body: unknown
}

export interface RouteResult {
  status: number
  body: unknown
}

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string // Express-style, e.g. '/api/tasks/:id/done'
  handler: (ctx: RouteContext) => Promise<RouteResult>
}

function buildViewRoutes(
  domain: string,
  databaseId: string,
  views: ViewConfig[],
  resultKey: string,
  toResult: (page: any) => any
): Route[] {
  return views.map((view) => ({
    method: 'GET',
    path: `/api/${domain}/${view.path}`,
    handler: async () => {
      try {
        const response = await notion.databases.query({
          database_id: databaseId,
          filter: view.filter ? translateFilter(view.filter) : undefined,
          sorts: view.sorts,
          page_size: 50,
        })
        return { status: 200, body: { [resultKey]: response.results.map(toResult) } }
      } catch (err: any) {
        console.error(`[server] /api/${domain}/${view.path} error:`, err.message)
        return { status: 500, body: { error: err.message } }
      }
    },
  }))
}

// ---------------------------------------------------------------------------
// POST /api/logs
// Browser-side console messages forwarded from the webview so they show up
// in the same terminal as the server logs when running `npm run dev:all`.
// Body: { level: string, line: string }
// ---------------------------------------------------------------------------
const logsRoute: Route = {
  method: 'POST',
  path: '/api/logs',
  handler: async ({ body }) => {
    const { level, line } = (body as any) ?? {}
    if (typeof line !== 'string') {
      return { status: 400, body: { error: 'Missing "line" in request body' } }
    }
    const tag = (typeof level === 'string' && level.trim()) || 'log'
    console.log(`[browser:${tag}] ${line}`)
    return { status: 200, body: { ok: true } }
  },
}

// ---------------------------------------------------------------------------
// GET /api/tasks/for-project/:projectId
// All tasks (any status) whose Project relation contains projectId,
// not-Done first then Done last.
// ---------------------------------------------------------------------------
const tasksForProjectRoute: Route = {
  method: 'GET',
  path: '/api/tasks/for-project/:projectId',
  handler: async ({ params }) => {
    try {
      const { projectId } = params
      const response = await notion.databases.query({
        database_id: config.notionTasksDb,
        filter: { property: 'Project', relation: { contains: projectId } },
        sorts: [{ property: 'Due', direction: 'ascending' }],
        page_size: 50,
      })
      const tasks = response.results.map(pageToTask)
      const notDone = tasks.filter((t) => t.status !== 'Done')
      const done = tasks.filter((t) => t.status === 'Done')
      return { status: 200, body: { tasks: [...notDone, ...done] } }
    } catch (err: any) {
      console.error('[server] GET /api/tasks/for-project/:projectId error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

// ---------------------------------------------------------------------------
// GET /api/notes/for-project/:projectId
// Non-archived notes whose Project relation contains projectId.
// ---------------------------------------------------------------------------
const notesForProjectRoute: Route = {
  method: 'GET',
  path: '/api/notes/for-project/:projectId',
  handler: async ({ params }) => {
    try {
      const { projectId } = params
      const response = await notion.databases.query({
        database_id: config.notionNotesDb,
        filter: {
          and: [
            { property: 'Archived', checkbox: { equals: false } },
            { property: 'Project', relation: { contains: projectId } },
          ],
        },
        sorts: [{ property: 'Updated', direction: 'descending' }],
        page_size: 50,
      })
      return { status: 200, body: { notes: response.results.map(pageToNote) } }
    } catch (err: any) {
      console.error('[server] GET /api/notes/for-project/:projectId error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// Create a new task in the Notion Tasks database
// Body: { name: string }
// ---------------------------------------------------------------------------
const createTaskRoute: Route = {
  method: 'POST',
  path: '/api/tasks',
  handler: async ({ body }) => {
    try {
      const { name } = (body as any) ?? {}
      if (!name || typeof name !== 'string') {
        return { status: 400, body: { error: 'Missing "name" in request body' } }
      }

      const page = await notion.pages.create({
        parent: { database_id: config.notionTasksDb },
        properties: {
          Name: {
            title: [{ text: { content: name } }],
          },
        },
      })

      return { status: 200, body: { id: page.id, name } }
    } catch (err: any) {
      console.error('[server] /api/tasks error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/done
// Mark a task Done in the Notion Tasks database
// ---------------------------------------------------------------------------
const markTaskDoneRoute: Route = {
  method: 'PATCH',
  path: '/api/tasks/:id/done',
  handler: async ({ params }) => {
    try {
      const { id } = params
      if (!id) {
        return { status: 400, body: { error: 'Missing task id' } }
      }
      const page = await notion.pages.update({
        page_id: id,
        properties: { Status: { status: { name: 'Done' } } },
      })
      return { status: 200, body: { id: page.id } }
    } catch (err: any) {
      console.error('[server] PATCH /api/tasks/:id/done error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/metadata
// Fetch a task's Project (resolved name) and Due date, on demand
// ---------------------------------------------------------------------------
const taskMetadataRoute: Route = {
  method: 'GET',
  path: '/api/tasks/:id/metadata',
  handler: async ({ params }) => {
    try {
      const { id } = params
      if (!id) {
        return { status: 400, body: { error: 'Missing task id' } }
      }
      const page: any = await notion.pages.retrieve({ page_id: id })
      const due = page.properties['Due']?.date?.start ?? null

      let project: string | null = null
      const rel = page.properties['Project']?.relation ?? []
      if (rel.length > 0) {
        const projectPage = await notion.pages.retrieve({ page_id: rel[0].id })
        project = pageTitle(projectPage)
      }

      return { status: 200, body: { project, due } }
    } catch (err: any) {
      console.error('[server] GET /api/tasks/:id/metadata error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// Move a task to the Notion Bin
// ---------------------------------------------------------------------------
const deleteTaskRoute: Route = {
  method: 'DELETE',
  path: '/api/tasks/:id',
  handler: async ({ params }) => {
    try {
      const { id } = params
      if (!id) {
        return { status: 400, body: { error: 'Missing task id' } }
      }
      const page = await notion.pages.update({
        page_id: id,
        in_trash: true,
      })
      return { status: 200, body: { id: page.id } }
    } catch (err: any) {
      console.error('[server] DELETE /api/tasks/:id error:', err.message)
      return { status: 500, body: { error: err.message } }
    }
  },
}

export const ROUTES: Route[] = [
  logsRoute,
  ...buildViewRoutes('tasks', config.notionTasksDb, TASK_VIEWS, 'tasks', pageToTask),
  ...buildViewRoutes('notes', config.notionNotesDb, NOTE_VIEWS, 'notes', pageToNote),
  ...buildViewRoutes('projects', config.notionProjectsDb, PROJECT_VIEWS, 'projects', pageToProject),
  ...buildViewRoutes('tags', config.notionTagsDb, TAG_VIEWS, 'tags', pageToTag),
  tasksForProjectRoute,
  notesForProjectRoute,
  createTaskRoute,
  markTaskDoneRoute,
  taskMetadataRoute,
  deleteTaskRoute,
]
