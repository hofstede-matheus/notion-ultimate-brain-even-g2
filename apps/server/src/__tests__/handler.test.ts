import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Notion client factory so an authorized request never touches the
// network — the fake query resolves empty so the view handler returns [].
const query = vi.fn().mockResolvedValue({ results: [] });
vi.mock('../notion-client', () => ({
  createNotionClient: vi.fn(() => ({ databases: { query } })),
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

  it('returns 401 for a non-public route without a tenant header', async () => {
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

  it('allows a public route (logs) with no tenant', async () => {
    const res = await handler(
      event({
        requestContext: { http: { method: 'POST' } },
        rawPath: '/api/logs',
        body: JSON.stringify({ line: 'hello' }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('decodes a base64-encoded body', async () => {
    const res = await handler(
      event({
        requestContext: { http: { method: 'POST' } },
        rawPath: '/api/logs',
        body: Buffer.from(JSON.stringify({ line: 'b64' })).toString('base64'),
        isBase64Encoded: true,
      }),
    );
    // A 200 proves the body was decoded (an undecoded body would 400 on the
    // missing "line").
    expect(res.statusCode).toBe(200);
  });

  it('handles an invalid JSON body without throwing', async () => {
    const res = await handler(
      event({
        requestContext: { http: { method: 'POST' } },
        rawPath: '/api/logs',
        body: 'not json',
      }),
    );
    expect(res.statusCode).toBe(400);
  });
});
