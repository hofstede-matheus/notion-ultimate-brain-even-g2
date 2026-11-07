/**
 * fetchWithRetry drives ky, which calls the injected `fetch` as
 * `fetch(request: Request, nonRequestOptions)` — not `fetch(url, init)` — so mocks here read
 * the request off the first positional argument. ky's backoff/timeout waits use real
 * setTimeout, so every test that can retry or time out needs fake timers +
 * vi.advanceTimersByTimeAsync (harness.ts's settle() only drains microtasks and can't drive
 * these).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../../http/client';
import { ApiError, CODE_NETWORK, CODE_TIMEOUT } from '../../http/errors';
import { clear as clearLog, getSnapshot } from '../../logging/sink';

// ky constructs a native Request internally before ever calling the mocked fetch, and Node's
// Request (unlike a real browser webview, which resolves against document.baseURI) requires
// an absolute URL. Production code passes relative paths fine — this is purely a Node test
// fixture concern.
const BASE = 'https://glasses.test';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestOf(call: unknown[]): Request {
  return call[0] as Request;
}

beforeEach(() => {
  clearLog();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('successful requests', () => {
  it('resolves the parsed JSON body on the first attempt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { ok: true })));

    const result = await fetchWithRetry(
      `${BASE}/api/x`,
      {},
      { label: `${BASE}/api/x`, previewBytes: 500 },
    );

    expect(result).toEqual({ ok: true });
  });
});

describe('retry on transient failure', () => {
  it('retries a 500 and returns the 200', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry(
      `${BASE}/api/x`,
      {},
      { label: `${BASE}/api/x`, previewBytes: 500 },
    );
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const info = getSnapshot().find((r) => r.level === 'info' && r.cat === 'API');
    expect(info?.ctx).toEqual({ attempts: 2 });
  });

  it("retries a PATCH that returns a 500 then a 200 — ky's default methods list excludes PATCH", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry(
      `${BASE}/api/tasks/1/done`,
      { method: 'PATCH' },
      { label: `${BASE}/api/tasks/1/done`, previewBytes: 500 },
    );
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses the same headers across every retry attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry(
      `${BASE}/api/x`,
      { headers: { 'X-Notion-Config': 'abc123' } },
      { label: `${BASE}/api/x`, previewBytes: 500 },
    );
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      expect(requestOf(call).headers.get('X-Notion-Config')).toBe('abc123');
    }
  });

  it('emits exactly one error line on final failure, and one warn per retried attempt', async () => {
    vi.useFakeTimers();
    // mockImplementation (not mockResolvedValue) — a real response body can only be read
    // once, so a retry re-consuming a shared Response instance throws.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => jsonResponse(500, { error: 'boom' })),
    );

    const promise = fetchWithRetry(
      `${BASE}/api/x`,
      {},
      { label: `${BASE}/api/x`, previewBytes: 500 },
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    const records = getSnapshot();
    expect(records.filter((r) => r.level === 'error')).toHaveLength(1);
    expect(records.filter((r) => r.level === 'warn')).toHaveLength(2); // MAX_RETRIES
  });
});

describe('permanent failures are not retried', () => {
  it('does not retry a plain 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'bad' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry(`${BASE}/api/x`, {}, { label: `${BASE}/api/x`, previewBytes: 500 }),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 500 whose body says validation_error — the config-health clamp trap', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: 'bad filter', code: 'validation_error' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry(`${BASE}/api/x`, {}, { label: `${BASE}/api/x`, previewBytes: 500 }),
    ).rejects.toMatchObject({ status: 500, code: 'validation_error' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries a POST, even on a 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry(
        `${BASE}/api/tasks`,
        { method: 'POST' },
        { label: `${BASE}/api/tasks`, previewBytes: 500 },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('timeouts', () => {
  it('a POST that never responds times out at 11s and is not retried', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry(
      `${BASE}/api/tasks`,
      { method: 'POST' },
      { label: `${BASE}/api/tasks`, previewBytes: 500 },
    );
    const assertion = expect(promise).rejects.toMatchObject({ status: 0, code: CODE_TIMEOUT });
    await vi.advanceTimersByTimeAsync(11000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a safe method under 6s does not time out', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    fetchWithRetry(`${BASE}/api/x`, {}, { label: `${BASE}/api/x`, previewBytes: 500 });
    await vi.advanceTimersByTimeAsync(5000);

    expect(getSnapshot().filter((r) => r.level === 'error')).toHaveLength(0);
  });
});

describe('network failures', () => {
  it('maps a network-level fetch rejection to ApiError with code network_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      fetchWithRetry(
        `${BASE}/api/tasks`,
        { method: 'POST' },
        { label: `${BASE}/api/tasks`, previewBytes: 500 },
      ),
    ).rejects.toMatchObject({ status: 0, code: CODE_NETWORK });
  });

  it('retries a persistent network failure on a safe method up to the retry limit', async () => {
    vi.useFakeTimers();
    // mockImplementation, not mockRejectedValue — a shared rejected-promise instance across
    // calls trips Node's PromiseRejectionHandledWarning even when the test awaits correctly.
    const fetchMock = vi.fn().mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry(
      `${BASE}/api/x`,
      {},
      { label: `${BASE}/api/x`, previewBytes: 500 },
    );
    const assertion = expect(promise).rejects.toMatchObject({ status: 0, code: CODE_NETWORK });
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + MAX_RETRIES
  });
});

describe('shared deadline (fetchAllPages budget)', () => {
  it('stops retrying once the deadline is too close for another attempt', async () => {
    vi.useFakeTimers();
    const deadline = Date.now() + 100; // narrower than backoffMs(1) === 400
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry(`${BASE}/api/x`, {}, { label: `${BASE}/api/x`, previewBytes: 500, deadline }),
    ).rejects.toMatchObject({ status: 500 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
