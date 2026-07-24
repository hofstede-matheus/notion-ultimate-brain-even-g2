/**
 * Every route in the app.
 *
 * Handlers stay as close to a pass-through as the endpoint allows: attach the
 * tenant's token, call Notion, hand the response back. The app is free and
 * this server is the only part that costs anything to run, so work that could
 * happen on the device happens on the device — pagination loops, tree walks,
 * parsing and formatting all belong in the glasses app. Before adding logic
 * here, check whether the client could do it instead; it almost always can.
 * See "Why the server stays a proxy" in the README.
 *
 * The one standing exception is the list-view mappers below, which trade a
 * little work here for a much smaller payload over a phone-tethered link.
 */

import type { Client } from '@notionhq/client';
import { APIErrorCode, isNotionClientError } from '@notionhq/client';
import { translateFilter } from './filters';
import type { NotionPage } from './mappers';
import {
  databaseToSummary,
  pageTitle,
  pageToNote,
  pageToProject,
  pageToTag,
  pageToTask,
} from './mappers';
import { createNotionClient } from './notion-client';
import type { TenantDb } from './tenant';
import { parseTenant, parseToken } from './tenant';
import {
  NOTE_VIEWS,
  PROJECT_VIEWS,
  TAG_VIEWS,
  TASK_STATUS_DONE,
  TASK_STATUS_TODO,
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
  // Notion's opaque pagination cursor (?cursor=... query param), when the
  // caller is resuming a list-view query past its first page.
  cursor?: string;
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
  // 'tenant' (default, omit) requires the full X-Notion-Config header (token +
  // all 4 DB ids). 'token' requires only X-Notion-Token — for routes that run
  // before DB ids are known, like the settings form's database picker.
  auth?: 'tenant' | 'token';
  handler: (ctx: RouteContext) => Promise<RouteResult>;
}

/**
 * Wraps a handler that needs a resolved tenant. `runRoute` already 401s a
 * request with no tenant before the handler runs, so reaching here without
 * `notion`/`db` is an invariant violation — we throw (caught by the S1
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

// Context for a 'token'-auth route: only `notion` is guaranteed (no `db` —
// the database picker runs before DB ids are known).
export interface TokenAuthedContext extends RouteContext {
  notion: Client;
}

/**
 * Like `authed()`, but for a 'token'-auth route: asserts only `ctx.notion`,
 * never `ctx.db`. `runRoute` guarantees `notion` is present before the
 * handler runs, so reaching here without it is an invariant violation.
 */
function tokenAuthed(
  handler: (ctx: TokenAuthedContext) => Promise<RouteResult>,
): (ctx: RouteContext) => Promise<RouteResult> {
  return (ctx) => {
    if (!ctx.notion) {
      throw new Error('Route requires a resolved Notion client, but none was present');
    }
    return handler(ctx as TokenAuthedContext);
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
 * Shared dispatch for both entry points: parses the tenant (or, for a
 * 'token'-auth route, the bare token) header, 401s a request with no valid
 * credential, builds the handler ctx, and runs it through the S1 error
 * boundary. Express and Lambda keep only their transport-specific glue
 * (param/body extraction, response serialization).
 */
export async function runRoute(
  route: Route,
  {
    params,
    body,
    tenantHeader,
    tokenHeader,
    cursor,
  }: {
    params: Record<string, string>;
    body: unknown;
    tenantHeader: string | string[] | undefined;
    tokenHeader?: string | string[] | undefined;
    cursor?: string;
  },
): Promise<RouteResult> {
  if (route.auth === 'token') {
    const token = parseToken(tokenHeader);
    if (!token) {
      return { status: 401, body: { error: 'Missing or invalid Notion token' } };
    }
    return invokeRoute(route, { params, body, notion: createNotionClient(token), cursor });
  }

  const tenant = parseTenant(tenantHeader);
  if (!tenant) {
    return { status: 401, body: { error: 'Missing or invalid Notion configuration' } };
  }
  return invokeRoute(route, {
    params,
    body,
    notion: createNotionClient(tenant.token),
    db: tenant.db,
    timeZone: tenant.timeZone,
    cursor,
  });
}

type DbKey = keyof TenantDb;

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
      const response = await ctx.notion.databases.query({
        database_id: ctx.db[dbKey],
        filter: (view.filter
          ? translateFilter(view.filter, ctx.timeZone)
          : undefined) as NotionQueryFilter,
        sorts: view.sorts,
        start_cursor: ctx.cursor,
        page_size: 100,
      });
      const pages = response.results as unknown as NotionPage[];
      return {
        status: 200,
        body: {
          [resultKey]: pages.map(toResult),
          hasMore: response.has_more,
          nextCursor: response.next_cursor,
        },
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// GET /api/tasks/for-project/:projectId/:status
// Tasks whose Project relation contains projectId, filtered to a single
// Status option — `status` is 'todo' (TASK_STATUS_TODO) or 'done'
// (TASK_STATUS_DONE). Filtering server-side, rather than fetching everything
// and splitting in JS, keeps a project with many Done tasks from crowding
// open tasks out of the page_size cap.
// ---------------------------------------------------------------------------
const tasksForProjectRoute: Route = {
  method: 'GET',
  path: '/api/tasks/for-project/:projectId/:status',
  handler: authed(async ({ params, notion, db, cursor }) => {
    const { projectId, status } = params;
    if (status !== 'todo' && status !== 'done') {
      return { status: 400, body: { error: 'Invalid status — expected "todo" or "done"' } };
    }
    const statusName = status === 'todo' ? TASK_STATUS_TODO : TASK_STATUS_DONE;
    const response = await notion.databases.query({
      database_id: db.tasks,
      filter: {
        and: [
          { property: 'Project', relation: { contains: projectId } },
          { property: 'Status', status: { equals: statusName } },
        ],
      },
      sorts: [{ property: 'Due', direction: 'ascending' }],
      start_cursor: cursor,
      page_size: 100,
    });
    const tasks = (response.results as unknown as NotionPage[]).map(pageToTask);
    return {
      status: 200,
      body: { tasks, hasMore: response.has_more, nextCursor: response.next_cursor },
    };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/notes/for-project/:projectId
// Non-archived notes whose Project relation contains projectId.
// ---------------------------------------------------------------------------
const notesForProjectRoute: Route = {
  method: 'GET',
  path: '/api/notes/for-project/:projectId',
  handler: authed(async ({ params, notion, db, cursor }) => {
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
      start_cursor: cursor,
      page_size: 100,
    });
    const notes = (response.results as unknown as NotionPage[]).map(pageToNote);
    return {
      status: 200,
      body: { notes, hasMore: response.has_more, nextCursor: response.next_cursor },
    };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/notes/for-tag/:tagId
// Non-archived notes whose Tag relation contains tagId.
// ---------------------------------------------------------------------------
const notesForTagRoute: Route = {
  method: 'GET',
  path: '/api/notes/for-tag/:tagId',
  handler: authed(async ({ params, notion, db, cursor }) => {
    const { tagId } = params;
    const response = await notion.databases.query({
      database_id: db.notes,
      filter: {
        and: [
          { property: 'Archived', checkbox: { equals: false } },
          { property: 'Tag', relation: { contains: tagId } },
        ],
      },
      sorts: [{ property: 'Updated', direction: 'descending' }],
      start_cursor: cursor,
      page_size: 100,
    });
    const notes = (response.results as unknown as NotionPage[]).map(pageToNote);
    return {
      status: 200,
      body: { notes, hasMore: response.has_more, nextCursor: response.next_cursor },
    };
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
// GET /api/pages/:id/metadata
// Fetch a page's Project (resolved name) and Due date, on demand. Generic
// over tasks and notes: both databases carry a Project relation, only tasks
// carry Due — reading a note's non-existent Due property just yields
// undefined, which the query below already treats as "no date" (`due: null`).
// The glasses app decides which fields to show for which kind of item.
// ---------------------------------------------------------------------------
const pageMetadataRoute: Route = {
  method: 'GET',
  path: '/api/pages/:id/metadata',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing page id' } };
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
// DELETE /api/pages/:id
// Move a page to the Notion Bin. Generic over tasks and notes — `pages.update`
// doesn't care which database a page belongs to, only the client decides
// what "delete" means for the item it's showing.
// ---------------------------------------------------------------------------
const deletePageRoute: Route = {
  method: 'DELETE',
  path: '/api/pages/:id',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing page id' } };
    }
    const page = await notion.pages.update({
      page_id: id,
      in_trash: true,
    });
    return { status: 200, body: { id: page.id } };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/pages/:id/markdown
// GET /api/pages/:id
//
// Straight forwards of the two Notion endpoints the page reader needs. Both
// hand back Notion's own response untouched — turning the markdown into
// display text, and reading the Description-property fallback for a page
// with no body at all, both happen in the glasses app (see its
// page-loader.ts and glasses/markdown-to-pages.ts).
//
// The markdown endpoint isn't in the @notionhq/client SDK (installed at
// 2.3.0) yet, so it goes through the client's own generic `request()` — the
// same call the SDK's typed methods build on, so auth/retries/base-URL still
// come from the shared per-tenant Client. Verified against this workspace: no
// Notion-Version override is needed, so the rest of the API (created against
// the SDK's pinned 2022-06-28) is unaffected.
// ---------------------------------------------------------------------------
const pageMarkdownRoute: Route = {
  method: 'GET',
  path: '/api/pages/:id/markdown',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing page id' } };
    }
    const response = await notion.request({ path: `pages/${id}/markdown`, method: 'get' });
    return { status: 200, body: response };
  }),
};

const pageRoute: Route = {
  method: 'GET',
  path: '/api/pages/:id',
  handler: authed(async ({ params, notion }) => {
    const { id } = params;
    if (!id) {
      return { status: 400, body: { error: 'Missing page id' } };
    }
    const page = await notion.pages.retrieve({ page_id: id });
    return { status: 200, body: page };
  }),
};

// ---------------------------------------------------------------------------
// GET /api/databases
// Databases the integration token can see, for the settings form's database
// picker — run before any DB id is known, so this is 'token'-auth rather
// than the usual full-tenant gate. Loops on Notion's search pagination so an
// integration shared with >100 databases still gets a complete list.
// ---------------------------------------------------------------------------
const listDatabasesRoute: Route = {
  method: 'GET',
  path: '/api/databases',
  auth: 'token',
  handler: tokenAuthed(async ({ notion }) => {
    try {
      const databases: { id: string; name: string }[] = [];
      let cursor: string | undefined;
      do {
        const response = await notion.search({
          filter: { property: 'object', value: 'database' },
          page_size: 100,
          start_cursor: cursor,
        });
        for (const result of response.results) {
          if (result.object === 'database' && 'title' in result) {
            databases.push(databaseToSummary(result));
          }
        }
        cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
      } while (cursor);
      return { status: 200, body: { databases } };
    } catch (err) {
      // Distinguish "bad token" from a genuine server error, so the settings
      // form can show a token-specific message instead of a generic failure.
      if (isNotionClientError(err) && 'code' in err && err.code === APIErrorCode.Unauthorized) {
        return { status: 401, body: { error: 'Invalid Notion token' } };
      }
      throw err;
    }
  }),
};

export const ROUTES: Route[] = [
  ...buildViewRoutes('tasks', 'tasks', TASK_VIEWS, 'tasks', pageToTask),
  ...buildViewRoutes('notes', 'notes', NOTE_VIEWS, 'notes', pageToNote),
  ...buildViewRoutes('projects', 'projects', PROJECT_VIEWS, 'projects', pageToProject),
  ...buildViewRoutes('tags', 'tags', TAG_VIEWS, 'tags', pageToTag),
  tasksForProjectRoute,
  notesForProjectRoute,
  notesForTagRoute,
  createTaskRoute,
  markTaskDoneRoute,
  pageMetadataRoute,
  deletePageRoute,
  pageMarkdownRoute,
  pageRoute,
  listDatabasesRoute,
];
