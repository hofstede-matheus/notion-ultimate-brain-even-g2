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
  // client.ts resolves API_BASE's relative paths ('/api/databases') against location.origin
  // (ky constructs a native Request before ever calling the mocked fetch, and Node's Request
  // has no notion of a page origin) — matches the real browser/webview runtime this always
  // runs in.
  vi.stubGlobal('location', new URL('https://glasses.test'));
});
afterEach(() => {
  _clearRegisteredSecretsForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchDatabases', () => {
  it('sends the token via X-Notion-Token and maps the response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { databases: [{ id: 'd1', name: 'Tasks' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDatabases('ntn_abc123');

    expect(result).toEqual([{ id: 'd1', name: 'Tasks' }]);
    // ky calls the injected fetch as fetch(request: Request, nonRequestOptions) — not
    // fetch(url, init) — so the header lives on the Request object, not a second init arg.
    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(request.headers.get('X-Notion-Token')).toBe('ntn_abc123');
  });

  it('passes the properties map through untouched, for the settings picker fit check', async () => {
    const properties = { Name: 'title', Meta: 'formula' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { databases: [{ id: 'd1', name: 'Tasks', properties }] }),
        ),
    );

    const result = await fetchDatabases('ntn_abc123');

    expect(result[0].properties).toEqual(properties);
  });

  it('throws InvalidTokenError on a 401, without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'nope' }));
    vi.stubGlobal('fetch', fetchMock);

    // 401 isn't in retry.ts's RETRYABLE_STATUSES — essential, since SettingsForm.tsx calls
    // this on a debounced keystroke and a bad token should fail fast, not retry three times.
    await expect(fetchDatabases('bad-token')).rejects.toBeInstanceOf(InvalidTokenError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 500 and eventually throws a generic error', async () => {
    vi.useFakeTimers();
    // mockImplementation, not mockResolvedValue — a real response body can only be read
    // once, so a retry re-consuming a shared Response instance throws.
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(500, { error: 'boom' }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchDatabases('ntn_abc123');
    const assertion = expect(promise).rejects.toThrow('status 500');
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + MAX_RETRIES
  });

  it('retries a 500 and succeeds once a later attempt returns 200', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))
      .mockResolvedValueOnce(jsonResponse(200, { databases: [{ id: 'd1', name: 'Tasks' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchDatabases('ntn_abc123');
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual([{ id: 'd1', name: 'Tasks' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
