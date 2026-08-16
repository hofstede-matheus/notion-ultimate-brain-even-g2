/**
 * Thin typed client for the evenhub-simulator automation HTTP API (pinned
 * 0.8.0 — see package.json). Mirrors what
 * .claude/skills/simulator-debug/scripts/simctl.py does for manual/agent use;
 * this is the same surface, in TS, for vitest.
 *
 * No JS-evaluation endpoint exists — ping/console/screenshot/input is the
 * whole surface. Every assertion in this suite is built from these four.
 */

export interface ConsoleEntry {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'trace' | string;
  message: string;
  ts: number;
}

export type InputAction = 'up' | 'down' | 'click' | 'double_click';

export class SimulatorClient {
  constructor(private readonly baseUrl: string) {}

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/ping`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return false;
      return (await res.text()).trim() === 'pong';
    } catch {
      return false;
    }
  }

  /** `sinceId` is exclusive and must be a non-negative integer — a negative value is an HTTP 400. */
  async console(sinceId?: number): Promise<{ entries: ConsoleEntry[]; total: number }> {
    const path = sinceId === undefined ? '/api/console' : `/api/console?since_id=${sinceId}`;
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`GET ${path} -> HTTP ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as { entries: ConsoleEntry[]; total: number };
  }

  async clearConsole(): Promise<void> {
    await fetch(`${this.baseUrl}/api/console`, { method: 'DELETE' });
  }

  async input(action: InputAction): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      throw new Error(`POST /api/input(${action}) -> HTTP ${res.status}: ${await res.text()}`);
    }
  }

  async screenshotGlasses(): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/screenshot/glasses`);
    if (!res.ok) throw new Error(`GET /api/screenshot/glasses -> HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async screenshotWebview(): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/screenshot/webview`);
    if (!res.ok) throw new Error(`GET /api/screenshot/webview -> HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
