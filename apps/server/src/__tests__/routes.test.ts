import type { Client } from '@notionhq/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Route, RouteContext } from '../routes';
import { invokeRoute, ROUTES } from '../routes';
import type { TenantDb } from '../tenant';

const db: TenantDb = {
  tasks: 'tasks-db',
  notes: 'notes-db',
  projects: 'projects-db',
  tags: 'tags-db',
};

function route(method: Route['method'], path: string): Route {
  const r = ROUTES.find((r) => r.method === method && r.path === path);
  if (!r) throw new Error(`route ${method} ${path} not found`);
  return r;
}

/** Build a fake Notion client whose methods are vitest mocks. */
function fakeNotion() {
  return {
    databases: { query: vi.fn() },
    pages: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
    // The generic escape hatch the markdown route uses — the SDK (installed
    // at 2.3.0) has no typed method for that endpoint yet.
    request: vi.fn(),
  };
}

function ctx(
  notion: ReturnType<typeof fakeNotion>,
  overrides: Partial<RouteContext> = {},
): RouteContext {
  return { params: {}, body: undefined, notion: notion as unknown as Client, db, ...overrides };
}

const titlePage = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  properties: { Name: { title: [{ plain_text: name }] }, ...extra },
});

// Silence the handlers' console.error/console.log noise.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('view routes', () => {
  it('queries the tenant database and maps results', async () => {
    const notion = fakeNotion();
    notion.databases.query.mockResolvedValue({
      results: [titlePage('t1', 'Task 1', { Status: { status: { name: 'Todo' } } })],
    });

    const res = await route('GET', '/api/tasks/inbox').handler(ctx(notion));

    expect(notion.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({ database_id: 'tasks-db', page_size: 50 }),
    );
    expect(res).toEqual({
      status: 200,
      body: { tasks: [{ id: 't1', name: 'Task 1', dueDate: undefined, status: 'Todo' }] },
    });
  });

  it('returns 500 with the error message when the query rejects', async () => {
    const notion = fakeNotion();
    notion.databases.query.mockRejectedValue(new Error('notion down'));

    const res = await invokeRoute(route('GET', '/api/tasks/inbox'), ctx(notion));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'notion down' });
  });
});

describe('POST /api/tasks (create)', () => {
  it('rejects a missing name with 400', async () => {
    const notion = fakeNotion();
    const res = await route('POST', '/api/tasks').handler(ctx(notion, { body: {} }));
    expect(res.status).toBe(400);
    expect(notion.pages.create).not.toHaveBeenCalled();
  });

  it('creates a task in the tenant tasks db', async () => {
    const notion = fakeNotion();
    notion.pages.create.mockResolvedValue({ id: 'new-id' });

    const res = await route('POST', '/api/tasks').handler(
      ctx(notion, { body: { name: 'Buy milk' } }),
    );

    expect(notion.pages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { database_id: 'tasks-db' },
        properties: { Name: { title: [{ text: { content: 'Buy milk' } }] } },
      }),
    );
    expect(res).toEqual({ status: 200, body: { id: 'new-id', name: 'Buy milk' } });
  });
});

describe('PATCH /api/tasks/:id/done', () => {
  it('marks the task Done', async () => {
    const notion = fakeNotion();
    notion.pages.update.mockResolvedValue({ id: 't1' });

    const res = await route('PATCH', '/api/tasks/:id/done').handler(
      ctx(notion, { params: { id: 't1' } }),
    );

    expect(notion.pages.update).toHaveBeenCalledWith({
      page_id: 't1',
      properties: { Status: { status: { name: 'Done' } } },
    });
    expect(res).toEqual({ status: 200, body: { id: 't1' } });
  });
});

describe('DELETE /api/pages/:id', () => {
  it('moves the page to the trash', async () => {
    const notion = fakeNotion();
    notion.pages.update.mockResolvedValue({ id: 't1' });

    const res = await route('DELETE', '/api/pages/:id').handler(
      ctx(notion, { params: { id: 't1' } }),
    );

    expect(notion.pages.update).toHaveBeenCalledWith({ page_id: 't1', in_trash: true });
    expect(res).toEqual({ status: 200, body: { id: 't1' } });
  });

  it('works for a note id exactly the same way — the route has no notion of "task"', async () => {
    const notion = fakeNotion();
    notion.pages.update.mockResolvedValue({ id: 'n1' });

    const res = await route('DELETE', '/api/pages/:id').handler(
      ctx(notion, { params: { id: 'n1' } }),
    );

    expect(res).toEqual({ status: 200, body: { id: 'n1' } });
  });
});

describe('GET /api/pages/:id/metadata', () => {
  it('resolves the project relation name and due date', async () => {
    const notion = fakeNotion();
    notion.pages.retrieve
      .mockResolvedValueOnce({
        properties: {
          Due: { date: { start: '2026-07-01' } },
          Project: { relation: [{ id: 'p1' }] },
        },
      })
      .mockResolvedValueOnce(titlePage('p1', 'Website'));

    const res = await route('GET', '/api/pages/:id/metadata').handler(
      ctx(notion, { params: { id: 't1' } }),
    );

    expect(res).toEqual({ status: 200, body: { project: 'Website', due: '2026-07-01' } });
    expect(notion.pages.retrieve).toHaveBeenCalledTimes(2);
  });

  it('returns null project when there is no relation', async () => {
    const notion = fakeNotion();
    notion.pages.retrieve.mockResolvedValueOnce({
      properties: { Due: { date: { start: '2026-07-01' } }, Project: { relation: [] } },
    });

    const res = await route('GET', '/api/pages/:id/metadata').handler(
      ctx(notion, { params: { id: 't1' } }),
    );

    expect(res).toEqual({ status: 200, body: { project: null, due: '2026-07-01' } });
    expect(notion.pages.retrieve).toHaveBeenCalledTimes(1);
  });

  it('resolves a project for a note the same way — Notes carry a Project relation too', async () => {
    const notion = fakeNotion();
    notion.pages.retrieve
      .mockResolvedValueOnce({ properties: { Project: { relation: [{ id: 'p1' }] } } })
      .mockResolvedValueOnce(titlePage('p1', 'Website'));

    const res = await route('GET', '/api/pages/:id/metadata').handler(
      ctx(notion, { params: { id: 'n1' } }),
    );

    // Notes have no Due property at all — reading it off the page object is
    // just `undefined`, which the route already normalises to `due: null`.
    expect(res).toEqual({ status: 200, body: { project: 'Website', due: null } });
  });
});

describe('GET /api/tasks/for-project/:projectId', () => {
  it('orders not-Done tasks before Done tasks', async () => {
    const notion = fakeNotion();
    notion.databases.query.mockResolvedValue({
      results: [
        titlePage('a', 'A', { Status: { status: { name: 'Done' } } }),
        titlePage('b', 'B', { Status: { status: { name: 'Todo' } } }),
        titlePage('c', 'C', { Status: { status: { name: 'Done' } } }),
      ],
    });

    const res = (await route('GET', '/api/tasks/for-project/:projectId').handler(
      ctx(notion, { params: { projectId: 'p1' } }),
    )) as { status: number; body: { tasks: { id: string }[] } };

    expect(res.body.tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});

// These two are pure forwards — the glasses app turns the markdown into
// display text, and reads the Description fallback — so the only thing to
// assert is that nothing is transformed on the way through, in either
// direction.
describe('GET /api/pages/:id/markdown', () => {
  it("hands back Notion's markdown response untouched", async () => {
    const notion = fakeNotion();
    const markdownResponse = {
      object: 'page_markdown',
      id: 'p1',
      markdown: '# Heading\n- a bullet',
      truncated: false,
      unknown_block_ids: [],
    };
    notion.request.mockResolvedValue(markdownResponse);

    const res = await route('GET', '/api/pages/:id/markdown').handler(
      ctx(notion, { params: { id: 'p1' } }),
    );

    // Goes through the SDK's generic request() rather than a typed method —
    // @notionhq/client (installed at 2.3.0) has no dedicated markdown method
    // yet, and this is the same call its typed methods build on.
    expect(notion.request).toHaveBeenCalledWith({ path: 'pages/p1/markdown', method: 'get' });
    expect(res).toEqual({ status: 200, body: markdownResponse });
  });
});

describe('GET /api/pages/:id', () => {
  it("hands back Notion's page object untouched", async () => {
    const notion = fakeNotion();
    const page = { object: 'page', id: 'p1', properties: { Description: { rich_text: [] } } };
    notion.pages.retrieve.mockResolvedValue(page);

    const res = await route('GET', '/api/pages/:id').handler(ctx(notion, { params: { id: 'p1' } }));

    expect(notion.pages.retrieve).toHaveBeenCalledWith({ page_id: 'p1' });
    expect(res).toEqual({ status: 200, body: page });
  });
});

describe('POST /api/logs (public)', () => {
  it('rejects a body without a line', async () => {
    const res = await route('POST', '/api/logs').handler({ params: {}, body: {} });
    expect(res.status).toBe(400);
  });

  it('accepts a valid log line', async () => {
    const res = await route('POST', '/api/logs').handler({
      params: {},
      body: { level: 'warn', line: 'hi' },
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
  });
});
