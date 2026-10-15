import { APIErrorCode, APIResponseError } from '@notionhq/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Notion client factory so an authorized request never touches the
// network — the fake query resolves empty so the view handler returns [].
const query = vi.fn().mockResolvedValue({ results: [] });
const create = vi.fn().mockResolvedValue({ id: 'page1' });
const search = vi.fn().mockResolvedValue({ results: [], has_more: false, next_cursor: null });
vi.mock('../notion-client', () => ({
  createNotionClient: vi.fn(() => ({ databases: { query }, pages: { create }, search })),
}));

// Real pino I/O isn't needed here — these tests assert response shape, not
// log output (that's covered by logger.test.ts's summarizeFailure tests).
// `summarizeFailure` stays un-mocked so the assertions below see what would
// really have been written.
// vi.hoisted, not a plain const: vi.mock is hoisted above module-level
// declarations, and this factory dereferences the spy immediately (unlike the
// notion-client one above, which only touches `query` when called).
const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock('../lambda/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lambda/logger')>();
  return {
    ...actual,
    logger: { error: logError, info: vi.fn() },
    flushLogger: vi.fn().mockResolvedValue(undefined),
  };
});

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

  it('reaches a token-auth route with only X-Notion-Token, no X-Notion-Config', async () => {
    const res = await handler(
      event({ rawPath: '/api/databases', headers: { 'x-notion-token': 'ntn_abc123' } }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ databases: [] });
    expect(createNotionClient).toHaveBeenCalledWith('ntn_abc123');
  });

  it('401s a token-auth route with no token header', async () => {
    const res = await handler(event({ rawPath: '/api/databases' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Missing or invalid Notion token' });
  });

  // What actually reaches CloudWatch. These guard the promise made on the
  // public privacy page: nothing on success, and no user data on failure.
  describe('logging', () => {
    const PAGE_ID = '8a4b2c1d9e7f4a3b8c6d5e4f3a2b1c0d';

    it('writes no log line at all for a successful request', async () => {
      const res = await handler(event({ headers: { 'x-notion-config': tenantHeader() } }));
      expect(res.statusCode).toBe(200);
      expect(logError).not.toHaveBeenCalled();
    });

    it('logs the route pattern, not the path with the page ID in it', async () => {
      // Authenticated so the failure comes from the handler (pages.update
      // isn't mocked, so it throws) rather than from the credential gate —
      // this is what still gets logged; see 'flood suppression' below for
      // the credential-gate case.
      await handler(
        event({
          requestContext: { http: { method: 'DELETE' } },
          rawPath: `/api/pages/${PAGE_ID}`,
          headers: { 'x-notion-config': tenantHeader() },
        }),
      );

      expect(logError).toHaveBeenCalledTimes(1);
      const [entry] = logError.mock.calls[0];
      expect(entry).toEqual({
        method: 'DELETE',
        route: '/api/pages/:id',
        status: 500,
        errorCode: 'unhandled_error',
      });
      expect(JSON.stringify(entry)).not.toContain(PAGE_ID);
    });

    // Both suppressed cases cost one Lambda invocation either way, and
    // previously cost a synchronous CloudWatch write on top — the cheapest
    // possible attack was also the most expensive request the function
    // served. See lambda/logger.ts's summarizeFailure and logger.test.ts for
    // the unit-level coverage of this; these two just confirm it holds
    // through the real handler.
    describe('flood suppression', () => {
      it('does not log an unmatched request', async () => {
        await handler(event({ rawPath: `/api/nope/${PAGE_ID}` }));
        expect(logError).not.toHaveBeenCalled();
      });

      it('does not log a request with no credential presented', async () => {
        await handler(
          event({
            requestContext: { http: { method: 'DELETE' } },
            rawPath: `/api/pages/${PAGE_ID}`,
          }),
        );
        expect(logError).not.toHaveBeenCalled();
      });
    });

    it('does not log the response body on a 500', async () => {
      query.mockRejectedValueOnce(new Error(`Could not find page "Therapy notes" (${PAGE_ID})`));

      const res = await handler(event({ headers: { 'x-notion-config': tenantHeader() } }));
      expect(res.statusCode).toBe(500);

      // `/api/tasks/inbox` is a static route pattern — the view name is app
      // vocabulary, not user data. Patterns that carry an identifier all use a
      // `:param` placeholder (`/api/pages/:id`), which is what keeps page IDs
      // out of the log.
      const [entry] = logError.mock.calls[0];
      expect(entry).toEqual({
        method: 'GET',
        route: '/api/tasks/inbox',
        status: 500,
        errorCode: 'unhandled_error',
      });
      const written = JSON.stringify(entry);
      expect(written).not.toContain('Therapy notes');
      expect(written).not.toContain(PAGE_ID);
    });

    it('passes through a 400 validation_error rather than flattening it to 500', async () => {
      query.mockRejectedValueOnce(
        new APIResponseError({
          code: APIErrorCode.ValidationError,
          status: 400,
          message: 'Could not find sort property with name or id: Meta',
          headers: new Headers(),
          rawBodyText: '',
        }),
      );

      const res = await handler(event({ headers: { 'x-notion-config': tenantHeader() } }));
      expect(res.statusCode).toBe(400);

      const [entry] = logError.mock.calls[0];
      expect(entry).toEqual({
        method: 'GET',
        route: '/api/tasks/inbox',
        status: 400,
        errorCode: 'validation_error',
      });
    });

    it('never receives the tenant headers', async () => {
      await handler(
        event({
          rawPath: `/api/pages/${PAGE_ID}`,
          requestContext: { http: { method: 'DELETE' } },
          headers: { 'x-notion-config': tenantHeader(), 'x-notion-token': 'ntn_supersecret' },
        }),
      );

      for (const call of logError.mock.calls) {
        const written = JSON.stringify(call);
        expect(written).not.toContain('ntn_supersecret');
        expect(written).not.toContain('secret');
        expect(written).not.toContain(tenantHeader());
      }
    });
  });
});
