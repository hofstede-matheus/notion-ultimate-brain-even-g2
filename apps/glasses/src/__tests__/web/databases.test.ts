import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _clearRegisteredSecretsForTests } from '../../logging/redact';
import { clear as clearLog, getSnapshot } from '../../logging/sink';
import { fetchDatabases, InvalidTokenError } from '../../web/services/databases';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  clearLog();
});
afterEach(() => {
  _clearRegisteredSecretsForTests();
  vi.unstubAllGlobals();
});

describe('fetchDatabases', () => {
  it('sends the token via X-Notion-Token and maps the response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { databases: [{ id: 'd1', name: 'Tasks' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDatabases('ntn_abc123');

    expect(result).toEqual([{ id: 'd1', name: 'Tasks' }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Notion-Token']).toBe('ntn_abc123');
  });

  it('throws InvalidTokenError on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'nope' })));

    await expect(fetchDatabases('bad-token')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('throws a generic error on other non-2xx statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: 'boom' })));

    await expect(fetchDatabases('ntn_abc123')).rejects.toThrow('status 500');
  });

  it('never lets the token reach the trace-log buffer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'nope' })));

    await expect(fetchDatabases('ntn_super-secret-value')).rejects.toBeInstanceOf(
      InvalidTokenError,
    );

    const lines = getSnapshot().map((r) => r.line);
    expect(lines.some((line) => line.includes('ntn_super-secret-value'))).toBe(false);
  });
});
