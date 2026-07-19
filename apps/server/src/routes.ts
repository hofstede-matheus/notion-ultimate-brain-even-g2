import type { Client } from '@notionhq/client';
import { translateFilter } from './filters';
import type { NotionPage } from './mappers';
import { pageTitle, pageToNote, pageToProject, pageToTag, pageToTask } from './mappers';
import { createNotionClient } from './notion-client';
import type { TenantDb } from './tenant';
import { parseTenant } from './tenant';
import {
  NOTE_VIEWS,
  PROJECT_VIEWS,
  resolveFilter,
  TAG_VIEWS,
  TASK_VIEWS,
  type ViewConfig,
} from './views';

export interface RouteContext {
  params: Record<string, string>;
  body: unknown;
  // Present for every non-public route — the entry points guarantee a valid
  // tenant was resolved from the request before the handler runs.
  notion?: Client;
  db?: TenantDb;
  // IANA timezone of the requesting device; drives relative-date resolution.
  timeZone?: string;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

// Context for handlers behind the tenant gate: `notion` and `db` are the
// resolved-tenant fields from RouteContext, narrowed to non-optional. Produced
// by `authed()` so handlers can use them without non-null assertions.
export interface AuthedContext extends RouteContext {
  notion: Client;
  db: TenantDb;
}

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string; // Express-style, e.g. '/api/tasks/:id/done'
  // Routes that don't touch Notion (e.g. /api/logs) skip the tenant gate.
  public?: boolean;
  handler: (ctx: RouteContext) => Promise<RouteResult>;
}

/**
 * Wraps a handler that needs a resolved tenant. `runRoute` already 401s a
 * non-public route with no tenant before the handler runs, so reaching here
 * without `notion`/`db` is an invariant violation — we throw (caught by the S1
 * boundary as a 500) rather than let a non-null assertion paper over it.
 */
function authed(
  handler: (ctx: AuthedContext) => Promise<RouteResult>,
): (ctx: RouteContext) => Promise<RouteResult> {
  return (ctx) => {
    if (!ctx.notion || !ctx.db) {
      throw new Error('Route requires a resolved tenant, but none was present');
    }
    return handler(ctx as AuthedContext);
  };
}

/**
 * Single 500-mapping boundary for both entry points (Express, Lambda) — the
 * one place a handler's thrown error becomes a RouteResult, so individual
 * handlers can stay straight-line "happy path" code.
 */
export async function invokeRoute(route: Route, ctx: RouteContext): Promise<RouteResult> {
  try {
    return await route.handler(ctx);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[server] ${route.method} ${route.path} error:`, message);
    return { status: 500, body: { error: message } };
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
  {
    params,
    body,
    tenantHeader,
  }: { params: Record<string, string>; body: unknown; tenantHeader: string | string[] | undefined },
): Promise<RouteResult> {
  const tenant = parseTenant(tenantHeader);
  if (!route.public && !tenant) {
    return { status: 401, body: { error: 'Missing or invalid Notion configuration' } };
  }
  return invokeRoute(route, {
    params,
    body,
    notion: tenant ? createNotionClient(tenant.token) : undefined,
    db: tenant?.db,
    timeZone: tenant?.timeZone,
  });
}

type DbKey = keyof Omit<TenantDb, 'excludeProjectId'>;

// The public databases.query params/results are far more precisely typed than
// the loose filter grammar (translateFilter) and page shape (NotionPage) this
// server works in. These aliases let us cast at that SDK boundary — the one
// place the two type worlds meet — without reaching for `any`.
type NotionQueryFilter = Parameters<Client['databases']['query']>[0]['filter'];

function buildViewRoutes(
  domain: string,
  dbKey: DbKey,
  views: ViewConfig[],
  resultKey: string,
  toResult: (page: NotionPage) => unknown,
): Route[] {
  return views.map((view) => ({
    method: 'GET',
    path: `/api/${domain}/${view.path}`,
    handler: authed(async (ctx) => {
      const filter = resolveFilter(view, ctx.db);
      const response = await ctx.notion.databases.query({
        database_id: ctx.db[dbKey],
        filter: (filter ? translateFilter(filter, ctx.timeZone) : undefined) as NotionQueryFilter,
        sorts: view.sorts,
        page_size: 50,
      });
      const pages = response.results as unknown as NotionPage[];
      return { status: 200, body: { [resultKey]: pages.map(toResult) } };
    }),
  }));
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
    const { level, line } = (body as { level?: unknown; line?: unknown }) ?? {};
    if (typeof line !== 'string') {
      return { status: 400, body: { error: 'Missing "line" in request body' } };
    }
    const tag = (typeof level === 'string' && level.trim()) || 'log';
    console.log(`[browser:${tag}] ${line}`);
    return { status: 200, body: { ok: true } };
  },
};

// ---------------------------------------------------------------------------
// GET /api/tasks/for-project/:projectId
// All tasks (any status) whose Project relation contains projectId,
// not-Done first then Done last.
// ---------------------------------------------------------------------------
const tasksForProjectRoute: Route = {
  method: 'GET',
  path: '/api/tasks/for-project/:projectId',
  handler: authed(async ({ params, notion, db }) => {
    const { projectId } = params;
    const response = await notion.databases.query({
      database_id: db.tasks,
      filter: { property: 'Project', relation: { contains: projectId } },
      sorts: [{ property: 'Due', direction: 'ascending' }],
      page_size: 50,
    });
    const tasks = (response.results as unknown as NotionPage[]).map(pageToTask);
    const notDone = tasks.filter((t) => t.status !== 'Done');
    const done = tasks.filter((t) => t.status === 'Done');
    return { status: 200, body: { tasks: [...notDone, ...done] } };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/notes/for-project/:projectId
// Non-archived notes whose Project relation contains projectId.
// ---------------------------------------------------------------------------
const notesForProjectRoute: Route = {
  method: 'GET',
  path: '/api/notes/for-project/:projectId',
  handler: authed(async ({ params, notion, db }) => {
    const { projectId } = params;
    const response = await notion.databases.query({
      database_id: db.notes,
      filter: {
        and: [
          { property: 'Archived', checkbox: { equals: false } },
          { property: 'Project', relation: { contains: projectId } },
        ],
      },
      sorts: [{ property: 'Updated', direction: 'descending' }],
      page_size: 50,
    });
    const notes = (response.results as unknown as NotionPage[]).map(pageToNote);
    return { status: 200, body: { notes } };
  }),
};

// ---------------------------------------------------------------------------
// POST /api/tasks
// Create a new task in the Notion Tasks database
// Body: { name: string }
// ---------------------------------------------------------------------------
const createTaskRoute: Route = {
  method: 'POST',
  path: '/api/tasks',
  handler: authed(async ({ body, notion, db }) => {
    const { name } = (body as { name?: unknown }) ?? {};
    if (!name || typeof name !== 'string') {
      return { status: 400, body: { error: 'Missing "name" in request body' } };
    }

    const page = await notion.pages.create({
      parent: { database_id: db.tasks },
      properties: {
        Name: {
          title: [{ text: { content: name } }],
        },
      },
    });

    return { status: 200, body: { id: page.id, name } };
  }),
};

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/done
// Mark a task Done in the Notion Tasks database
// ---------------------------------------------------------------------------
const markTaskDoneRoute: Route = {
  method: 'PATCH',
  path: '/api/tasks/:id/done',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } };
    }
    const page = await notion.pages.update({
      page_id: id,
      properties: { Status: { status: { name: 'Done' } } },
    });
    return { status: 200, body: { id: page.id } };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/metadata
// Fetch a task's Project (resolved name) and Due date, on demand
// ---------------------------------------------------------------------------
const taskMetadataRoute: Route = {
  method: 'GET',
  path: '/api/tasks/:id/metadata',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } };
    }
    const page = (await notion.pages.retrieve({ page_id: id })) as NotionPage;
    const due = page.properties?.Due?.date?.start ?? null;

    let project: string | null = null;
    const [firstRelation] = page.properties?.Project?.relation ?? [];
    if (firstRelation) {
      const projectPage = (await notion.pages.retrieve({
        page_id: firstRelation.id,
      })) as NotionPage;
      project = pageTitle(projectPage);
    }

    return { status: 200, body: { project, due } };
  }),
};

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// Move a task to the Notion Bin
// ---------------------------------------------------------------------------
const deleteTaskRoute: Route = {
  method: 'DELETE',
  path: '/api/tasks/:id',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing task id' } };
    }
    const page = await notion.pages.update({
      page_id: id,
      in_trash: true,
    });
    return { status: 200, body: { id: page.id } };
  }),
};

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
];
