import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Note, Project, Tag, Task } from '@notion-ub/contracts';
import {
  DOING_PROJECTS,
  EMPTY_PROJECTS,
  EMPTY_TAGS,
  INBOX_NOTES,
  NEXT_7_DAYS_TASKS,
  PAGE_DETAILS,
  PROJECT_TODO_TASKS,
  READER_MARKDOWN,
  RECENT_TAGS,
  TAG_NOTES,
  TODAY_TASKS,
} from '../fixtures';

/**
 * A deterministic stand-in for apps/server, serving the same 15 route shapes
 * (see apps/server/src/routes.ts) with no Notion credentials and no network
 * call — see the integration README's "Fixture server, not real server" note
 * for why apps/server itself is intentionally left out of this loop.
 *
 * The dataset is static: mutation routes below RECORD what was called
 * (exposed at GET /__calls for a spec to assert on) but never change what a
 * later GET returns. A spec asserts a mutation happened via the recorded
 * call and the app's own trace lines, not by re-fetching and diffing a list.
 */

interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

let calls: RecordedCall[] = [];

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function pagedTasks(items: Task[]): { tasks: Task[]; hasMore: boolean; nextCursor: null } {
  return { tasks: items, hasMore: false, nextCursor: null };
}
function pagedNotes(items: Note[]): { notes: Note[]; hasMore: boolean; nextCursor: null } {
  return { notes: items, hasMore: false, nextCursor: null };
}
function pagedProjects(items: Project[]): {
  projects: Project[];
  hasMore: boolean;
  nextCursor: null;
} {
  return { projects: items, hasMore: false, nextCursor: null };
}
function pagedTags(items: Tag[]): { tags: Tag[]; hasMore: boolean; nextCursor: null } {
  return { tags: items, hasMore: false, nextCursor: null };
}

// View path -> fixture data. Absent = empty list (a deliberately valid
// response — most views aren't exercised by the current spec batch).
const TASK_VIEW_DATA: Record<string, Task[]> = {
  today: TODAY_TASKS,
  'next-7-days': NEXT_7_DAYS_TASKS,
};
const NOTE_VIEW_DATA: Record<string, Note[]> = {
  inbox: INBOX_NOTES,
};
const PROJECT_VIEW_DATA: Record<string, Project[]> = {
  doing: DOING_PROJECTS,
  // The picker fetches the Board view (DATA_KEY_OVERRIDES in navigation.ts)
  // even though it renders a static filter menu — answer it with real data
  // rather than an empty list so the fetch looks like every other one.
  board: DOING_PROJECTS,
};
const TAG_VIEW_DATA: Record<string, Tag[]> = {
  recent: RECENT_TAGS,
};

type Handler = (params: string[], body: unknown) => { status: number; body: unknown };

interface RouteEntry {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const ROUTES: RouteEntry[] = [
  // Tasks — GET /api/tasks/<view>, where <view> is one of TASK_VIEWS' paths.
  {
    method: 'GET',
    pattern: /^\/api\/tasks\/(inbox|today|next-7-days|tomorrow)$/,
    handler: ([view]) => ({ status: 200, body: pagedTasks(TASK_VIEW_DATA[view ?? ''] ?? []) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/tasks\/for-project\/[^/]+\/(todo|done)$/,
    handler: ([status]) => ({
      status: 200,
      body: pagedTasks(status === 'todo' ? PROJECT_TODO_TASKS : []),
    }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/tasks$/,
    handler: (_params, body) => {
      const name = (body as { name?: string } | undefined)?.name ?? '';
      return { status: 200, body: { id: `created-${Date.now()}`, name } };
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/tasks\/([^/]+)\/done$/,
    handler: ([id]) => ({ status: 200, body: { id } }),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/tasks\/([^/]+)\/due$/,
    handler: ([id]) => ({ status: 200, body: { id } }),
  },

  // Notes — GET /api/notes/<view>.
  {
    method: 'GET',
    pattern:
      /^\/api\/notes\/(inbox|favorites|by-tag|notes|meetings|by-project|clips|voice|journal|all)$/,
    handler: ([view]) => ({ status: 200, body: pagedNotes(NOTE_VIEW_DATA[view ?? ''] ?? []) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/notes\/for-project\/[^/]+$/,
    handler: () => ({ status: 200, body: pagedNotes([]) }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/notes\/for-tag\/([^/]+)$/,
    handler: ([tagId]) => ({
      status: 200,
      body: pagedNotes(tagId === 'tag-health' ? TAG_NOTES : []),
    }),
  },

  // Projects — GET /api/projects/<view>.
  {
    method: 'GET',
    pattern: /^\/api\/projects\/(all|doing|ongoing|planned|on-hold|done|board|archived)$/,
    handler: ([view]) => ({
      status: 200,
      body: pagedProjects(PROJECT_VIEW_DATA[view ?? ''] ?? EMPTY_PROJECTS),
    }),
  },

  // Tags — GET /api/tags/<view> and GET /api/tags/types/<type>.
  {
    method: 'GET',
    pattern: /^\/api\/tags\/(recent|favorites|a-z)$/,
    handler: ([view]) => ({
      status: 200,
      body: pagedTags(TAG_VIEW_DATA[view ?? ''] ?? EMPTY_TAGS),
    }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/tags\/types\/(area|resource|entity)$/,
    handler: () => ({ status: 200, body: pagedTags(EMPTY_TAGS) }),
  },

  // Pages — generic over tasks/notes/projects.
  {
    method: 'GET',
    pattern: /^\/api\/pages\/([^/]+)\/details$/,
    handler: ([id]) => ({
      status: 200,
      body: PAGE_DETAILS[id ?? ''] ?? { project: null, due: null },
    }),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/pages\/([^/]+)\/project$/,
    handler: ([id]) => ({ status: 200, body: { id } }),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/pages\/([^/]+)$/,
    handler: ([id]) => ({ status: 200, body: { id } }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/pages\/([^/]+)\/markdown$/,
    handler: ([id]) => ({
      status: 200,
      body: { markdown: id === 'note-reader' ? READER_MARKDOWN : '', truncated: false },
    }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/pages\/([^/]+)$/,
    handler: ([id]) => ({
      status: 200,
      body: { id, properties: { Description: { rich_text: [] } } },
    }),
  },
];

function matchRoute(method: string, path: string): { handler: Handler; params: string[] } | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (match) return { handler: route.handler, params: match.slice(1) as string[] };
  }
  return null;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const path = (req.url ?? '/').split('?')[0] ?? '/';

  if (path === '/__calls' && method === 'GET') {
    json(res, 200, { calls });
    return;
  }
  if (path === '/__reset' && method === 'POST') {
    calls = [];
    json(res, 200, { ok: true });
    return;
  }

  const isMutation = method === 'POST' || method === 'PATCH' || method === 'DELETE';
  const body = isMutation ? await readBody(req).catch(() => undefined) : undefined;
  if (isMutation) calls.push({ method, path, body });

  const match = matchRoute(method, path);
  if (!match) {
    // Loud and specific, not a hang or a generic 404 — an unmatched call
    // means a spec exercised an endpoint this fixture doesn't implement yet.
    console.error(`[fixture-server] 501 Unhandled: ${method} ${path}`);
    json(res, 501, { error: `Unhandled: ${method} ${path}` });
    return;
  }

  const result = match.handler(match.params, body);
  json(res, result.status, result.body);
}

export function startFixtureServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((err) => {
        console.error('[fixture-server] handler error', err);
        json(res, 500, { error: 'fixture-server internal error' });
      });
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      calls = [];
      resolve(server);
    });
  });
}

export function stopFixtureServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
