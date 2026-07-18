import type { Client } from '@notionhq/client'
import { pageTitle, pageToTask, pageToNote, pageToProject, pageToTag } from './mappers'
import { translateFilter } from './filters'
import { ViewConfig, TASK_VIEWS, NOTE_VIEWS, PROJECT_VIEWS, TAG_VIEWS, resolveFilter } from './views'
import { parseTenant } from './tenant'
import type { TenantDb } from './tenant'
import { createNotionClient } from './notion-client'

export interface RouteContext {
  params: Record<string, string>
  body: unknown
  // Present for every non-public route — the entry points guarantee a valid
  // tenant was resolved from the request before the handler runs.
  notion?: Client
  db?: TenantDb
}

export interface RouteResult {
  status: number
  body: unknown
}

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string // Express-style, e.g. '/api/tasks/:id/done'
  // Routes that don't touch Notion (e.g. /api/logs) skip the tenant gate.
  public?: boolean
  handler: (ctx: RouteContext) => Promise<RouteResult>
}

/**
 * Single 500-mapping boundary for both entry points (Express, Lambda) — the
 * one place a handler's thrown error becomes a RouteResult, so individual
 * handlers can stay straight-line "happy path" code.
 */
export async function invokeRoute(route: Route, ctx: RouteContext): Promise<RouteResult> {
  try {
    return await route.handler(ctx)
  } catch (err: any) {
    console.error(`[server] ${route.method} ${route.path} error:`, err.message)
    return { status: 500, body: { error: err.message } }
  }
}

/**
 * Shared dispatch for both entry points: parses the tenant header, 401s a
 * non-public route with no valid tenant, builds the handler ctx, and runs it
 * through the S1 error boundary. Express and Lambda keep only their
 * transport-specific glue (param/body extraction, response serialization).
 */
export async function runRoute(
  route: Route,
  { params, body, tenantHeader }: { params: Record<string, string>; body: unknown; tenantHeader: string | string[] | undefined }
): Promise<RouteResult> {
  const tenant = parseTenant(tenantHeader)
  if (!route.public && !tenant) {
    return { status: 401, body: { error: 'Missing or invalid Notion configuration' } }
  }
  return invokeRoute(route, {
    params,
    body,
    notion: tenant ? createNotionClient(tenant.token) : undefined,
    db: tenant?.db,
  })
}

type DbKey = keyof Omit<TenantDb, 'excludeProjectId'>

function buildViewRoutes(
  domain: string,
  dbKey: DbKey,
  views: ViewConfig[],
  resultKey: string,
  toResult: (page: any) => any
): Route[] {
  return views.map((view) => ({
    method: 'GET',
    path: `/api/${domain}/${view.path}`,
    handler: async (ctx: RouteContext) => {
      const filter = resolveFilter(view, ctx.db!)
      const response = await ctx.notion!.databases.query({
        database_id: ctx.db![dbKey],
        filter: filter ? translateFilter(filter) : undefined,
        sorts: view.sorts,
        page_size: 50,
      })
      return { status: 200, body: { [resultKey]: response.results.map(toResult) } }
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
  public: true,
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
  handler: async ({ params, notion, db }) => {
    const { projectId } = params
    const response = await notion!.databases.query({
      database_id: db!.tasks,
      filter: { property: 'Project', relation: { contains: projectId } },
      sorts: [{ property: 'Due', direction: 'ascending' }],
      page_size: 50,
    })
    const tasks = response.results.map(pageToTask)
    const notDone = tasks.filter((t) => t.status !== 'Done')
    const done = tasks.filter((t) => t.status === 'Done')
    return { status: 200, body: { tasks: [...notDone, ...done] } }
  },
}

// ---------------------------------------------------------------------------
// GET /api/notes/for-project/:projectId
// Non-archived notes whose Project relation contains projectId.
// ---------------------------------------------------------------------------
const notesForProjectRoute: Route = {
  method: 'GET',
  path: '/api/notes/for-project/:projectId',
  handler: async ({ params, notion, db }) => {
    const { projectId } = params
    const response = await notion!.databases.query({
      database_id: db!.notes,
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
  handler: async ({ body, notion, db }) => {
    const { name } = (body as any) ?? {}
    if (!name || typeof name !== 'string') {
      return { status: 400, body: { error: 'Missing "name" in request body' } }
    }

    const page = await notion!.pages.create({
      parent: { database_id: db!.tasks },
      properties: {
        Name: {
          title: [{ text: { content: name } }],
        },
      },
    })

    return { status: 200, body: { id: page.id, name } }
  },
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/done
// Mark a task Done in the Notion Tasks database
// ---------------------------------------------------------------------------
const markTaskDoneRoute: Route = {
  method: 'PATCH',
  path: '/api/tasks/:id/done',
  handler: async ({ params, notion }) => {
    const { id } = params
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } }
    }
    const page = await notion!.pages.update({
      page_id: id,
      properties: { Status: { status: { name: 'Done' } } },
    })
    return { status: 200, body: { id: page.id } }
  },
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/metadata
// Fetch a task's Project (resolved name) and Due date, on demand
// ---------------------------------------------------------------------------
const taskMetadataRoute: Route = {
  method: 'GET',
  path: '/api/tasks/:id/metadata',
  handler: async ({ params, notion }) => {
    const { id } = params
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } }
    }
    const page: any = await notion!.pages.retrieve({ page_id: id })
    const due = page.properties['Due']?.date?.start ?? null

    let project: string | null = null
    const rel = page.properties['Project']?.relation ?? []
    if (rel.length > 0) {
      const projectPage = await notion!.pages.retrieve({ page_id: rel[0].id })
      project = pageTitle(projectPage)
    }

    return { status: 200, body: { project, due } }
  },
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// Move a task to the Notion Bin
// ---------------------------------------------------------------------------
const deleteTaskRoute: Route = {
  method: 'DELETE',
  path: '/api/tasks/:id',
  handler: async ({ params, notion }) => {
    const { id } = params
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } }
    }
    const page = await notion!.pages.update({
      page_id: id,
      in_trash: true,
    })
    return { status: 200, body: { id: page.id } }
  },
}

export const ROUTES: Route[] = [
  logsRoute,
  ...buildViewRoutes('tasks', 'tasks', TASK_VIEWS, 'tasks', pageToTask),
  ...buildViewRoutes('notes', 'notes', NOTE_VIEWS, 'notes', pageToNote),
  ...buildViewRoutes('projects', 'projects', PROJECT_VIEWS, 'projects', pageToProject),
  ...buildViewRoutes('tags', 'tags', TAG_VIEWS, 'tags', pageToTag),
  tasksForProjectRoute,
  notesForProjectRoute,
  createTaskRoute,
  markTaskDoneRoute,
  taskMetadataRoute,
  deleteTaskRoute,
]
