import { afterEach, describe, expect, it } from 'vitest';
import { summarizeResult } from '../lambda/logger';
import type { RouteResult } from '../routes';

const ORIGINAL_DEBUG = process.env.DEBUG;
afterEach(() => {
  process.env.DEBUG = ORIGINAL_DEBUG;
});

describe('summarizeResult', () => {
  it('omits the body for a successful call', () => {
    const result: RouteResult = { status: 200, body: { tasks: [] } };
    const entry = summarizeResult('GET', '/api/tasks/inbox', result, 12);
    expect(entry).toEqual({
      method: 'GET',
      path: '/api/tasks/inbox',
      status: 200,
      durationMs: 12,
      bodyBytes: Buffer.byteLength(JSON.stringify(result.body), 'utf-8'),
    });
  });

  it('includes the body for a failed call', () => {
    const result: RouteResult = { status: 404, body: { error: 'No route for GET /api/nope' } };
    const entry = summarizeResult('GET', '/api/nope', result, 3);
    expect(entry).toMatchObject({ status: 404, body: result.body });
  });

  it('includes the body for a 5xx call', () => {
    const result: RouteResult = { status: 500, body: { error: 'boom' } };
    const entry = summarizeResult('POST', '/api/tasks', result, 5);
    expect(entry).toMatchObject({ status: 500, body: result.body });
  });

  it('includes the body for a successful call when DEBUG=true', () => {
    process.env.DEBUG = 'true';
    const result: RouteResult = { status: 200, body: { tasks: [] } };
    const entry = summarizeResult('GET', '/api/tasks/inbox', result, 12);
    expect(entry).toMatchObject({ status: 200, body: result.body });
  });

  it('reports the byte length of the serialized body', () => {
    const result: RouteResult = { status: 200, body: { name: 'café' } };
    const entry = summarizeResult('POST', '/api/tasks', result, 1);
    expect(entry.bodyBytes).toBe(Buffer.byteLength(JSON.stringify(result.body), 'utf-8'));
  });
});
