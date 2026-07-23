import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Notion client factory so an authorized request never touches the
// network — the fake query resolves empty so the view handler returns [].
const query = vi.fn().mockResolvedValue({ results: [] });
const create = vi.fn().mockResolvedValue({ id: 'page1' });
vi.mock('../notion-client', () => ({
  createNotionClient: vi.fn(() => ({ databases: { query }, pages: { create } })),
}));

import { handler, type LambdaFunctionUrlEvent } from '../lambda/handler';
import { createNotionClient } from '../notion-client';

function tenantHeader(): string {
  return Buffer.from(
    JSON.stringify({
      token: 'secret',
      tasksDb: 'tasks-id',
      notesDb: 'notes-id',
      projectsDb: 'projects-id',
      tagsDb: 'tags-id',
    }),
  ).toString('base64');
}

function event(overrides: Partial<LambdaFunctionUrlEvent> = {}): LambdaFunctionUrlEvent {
  return {
    requestContext: { http: { method: 'GET' } },
    rawPath: '/api/tasks/inbox',
    headers: {},
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('lambda handler', () => {
  it('returns 404 for an unknown route', async () => {
    const res = await handler(
      event({ rawPath: '/api/nope', requestContext: { http: { method: 'GET' } } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 for a route without a tenant header', async () => {
    const res = await handler(event());
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Missing or invalid Notion configuration' });
  });

  it('returns 401 for a non-public route with an invalid tenant header', async () => {
    const res = await handler(event({ headers: { 'x-notion-config': 'garbage' } }));
    expect(res.statusCode).toBe(401);
  });

  it('injects a tenant client and reaches the handler when authorized', async () => {
    const res = await handler(event({ headers: { 'x-notion-config': tenantHeader() } }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ tasks: [] });
    expect(createNotionClient).toHaveBeenCalledWith('secret');
  });

  it('decodes a base64-encoded body', async () => {
    const res = await handler(
      event({
        requestContext: { http: { method: 'POST' } },
        rawPath: '/api/tasks',
        headers: { 'x-notion-config': tenantHeader() },
        body: Buffer.from(JSON.stringify({ name: 'b64' })).toString('base64'),
        isBase64Encoded: true,
      }),
    );
    // A 200 proves the body was decoded (an undecoded body would 400 on the
    // missing "name").
    expect(res.statusCode).toBe(200);
  });

  it('handles an invalid JSON body without throwing', async () => {
    const res = await handler(
      event({
        requestContext: { http: { method: 'POST' } },
        rawPath: '/api/tasks',
        headers: { 'x-notion-config': tenantHeader() },
        body: 'not json',
      }),
    );
    expect(res.statusCode).toBe(400);
  });
});
