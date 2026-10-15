import { describe, expect, it } from 'vitest';
import { summarizeFailure } from '../lambda/logger';
import type { RouteResult } from '../routes';

describe('summarizeFailure', () => {
  it('logs nothing at all for a successful call', () => {
    const result: RouteResult = { status: 200, body: { tasks: [{ id: 'p1', name: 'Buy milk' }] } };
    expect(summarizeFailure('GET', '/api/tasks/inbox', result)).toBeUndefined();
  });

  it('logs nothing for any 2xx/3xx', () => {
    for (const status of [200, 201, 204, 304]) {
      expect(summarizeFailure('GET', '/api/tasks/inbox', { status, body: {} })).toBeUndefined();
    }
  });

  it('reports method, route and status for a failure on a matched route', () => {
    const result: RouteResult = {
      status: 404,
      body: { error: 'Could not find page' },
      errorCode: 'object_not_found',
    };
    expect(summarizeFailure('GET', '/api/pages/:id/markdown', result)).toStrictEqual({
      method: 'GET',
      route: '/api/pages/:id/markdown',
      status: 404,
      errorCode: 'object_not_found',
    });
  });

  it('does not add errorCode when the route result has none', () => {
    const entry = summarizeFailure('GET', '/api/tasks/inbox', {
      status: 500,
      body: { error: 'boom' },
    });
    expect(entry).toStrictEqual({
      method: 'GET',
      route: '/api/tasks/inbox',
      status: 500,
    });
    expect(entry).not.toHaveProperty('errorCode');
  });

  it('includes the Notion error code when there is one', () => {
    const result: RouteResult = {
      status: 500,
      body: { error: 'Could not find page with ID: 8a4b…' },
      errorCode: 'object_not_found',
    };
    expect(summarizeFailure('GET', '/api/pages/:id/markdown', result)).toEqual({
      method: 'GET',
      route: '/api/pages/:id/markdown',
      status: 500,
      errorCode: 'object_not_found',
    });
  });

  // Both of these are also the cheapest possible attack: one Lambda
  // invocation, no diagnostic content, previously a synchronous CloudWatch
  // write on top. Suppressing them turns a flood back into something that
  // costs only compute, not compute plus logging.
  describe('flood suppression', () => {
    it('logs nothing for an unmatched route — a wrong or guessed path has no diagnostic content beyond "someone hit an unknown path"', () => {
      const result: RouteResult = { status: 404, body: { error: 'No route' } };
      expect(summarizeFailure('GET', 'unmatched', result)).toBeUndefined();
    });

    it('logs nothing when no credential was presented at all', () => {
      const result: RouteResult = {
        status: 401,
        body: { error: 'Missing or invalid Notion configuration' },
        errorCode: 'missing_credentials',
      };
      expect(summarizeFailure('POST', '/api/tasks', result)).toBeUndefined();
    });

    it('still logs a downstream 401 — Notion rejecting a credential that WAS presented means a real integration broke', () => {
      const result: RouteResult = { status: 401, body: { error: 'Invalid Notion token' } };
      expect(summarizeFailure('GET', '/api/databases', result)).toStrictEqual({
        method: 'GET',
        route: '/api/databases',
        status: 401,
      });
    });
  });

  // The point of the whole module. If a change makes one of these fail, the
  // fix is to stop logging the new thing — not to update the assertion.
  describe('privacy contract', () => {
    it('never logs the response body, even on a 5xx', () => {
      const result: RouteResult = {
        status: 500,
        body: { error: 'Could not find page "Therapy notes" (id 8a4b)' },
        errorCode: 'object_not_found',
      };
      const entry = summarizeFailure('GET', '/api/pages/:id/markdown', result);
      expect(JSON.stringify(entry)).not.toContain('Therapy notes');
      expect(JSON.stringify(entry)).not.toContain('8a4b');
      expect(entry).not.toHaveProperty('body');
    });

    it('emits only the whitelisted keys', () => {
      const entry = summarizeFailure('POST', '/api/tasks', {
        status: 500,
        body: { error: 'boom' },
        errorCode: 'internal_server_error',
      });
      expect(Object.keys(entry ?? {}).sort()).toEqual(['errorCode', 'method', 'route', 'status']);
    });

    // No environment variable may widen what is logged — the promise on the
    // landing page has to hold for the deployed function, whatever it's
    // deployed with. DEBUG is the name most likely to be reached for.
    it('ignores environment variables that might be meant to raise verbosity', () => {
      const original = { ...process.env };
      process.env.DEBUG = 'true';
      process.env.LOG_LEVEL = 'debug';
      process.env.VERBOSE = '1';
      try {
        const result: RouteResult = { status: 200, body: { name: 'Buy milk' } };
        expect(summarizeFailure('GET', '/api/tasks/inbox', result)).toBeUndefined();
      } finally {
        process.env = original;
      }
    });
  });
});
