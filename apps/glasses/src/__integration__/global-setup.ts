import { type ChildProcess, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { SimulatorClient } from './driver/simulator';
import { FIXTURE_PORT, SIM_PORT, SIM_URL, VITE_URL } from './env';
import { startFixtureServer, stopFixtureServer } from './fixture-server/server';

/**
 * One-time setup for the whole integration run: fixture server -> vite dev
 * server (against a synthetic env, never the developer's real .env.local) ->
 * simulator, in that order, torn down in reverse. See
 * src/__integration__/README.md for the architecture this wires together.
 */

const RUNTIME_DIR = fileURLToPath(new URL('./.runtime', import.meta.url));
const ENV_DIR = fileURLToPath(new URL('./.runtime/env', import.meta.url));
const VITE_CONFIG = fileURLToPath(new URL('../../vite.e2e.config.ts', import.meta.url));
const GLASSES_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A previously-saved TenantConfig persisted in the simulator's own on-disk
 * WebKit/WebKitGTK/WebView2 profile (NOT this repo, NOT anything git-ignores)
 * would make boot.ts's loadStoredConfig() win over our env-based config,
 * silently pointing the suite at a stale — possibly real — tenant instead of
 * the fixture server's fake one. Confirmed on macOS: that profile lives at
 * ~/Library/WebKit/evenhub-simulator, untouched by `pnpm install` or git.
 * There is no automation-API way to clear it (no JS-eval endpoint), so this
 * is a loud, actionable failure rather than a silent wrong result.
 */
const STALE_CONFIG_MESSAGE =
  "simulator has a saved Notion config beating this suite's fixture config — clear " +
  '~/Library/WebKit/evenhub-simulator (macOS; WebKitGTK/WebView2 profile elsewhere) and re-run';

function tenantId(): string {
  return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function assertPortFree(name: string, url: string): Promise<void> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
  } catch {
    return; // connection refused / timed out — the port is free, as expected
  }
  throw new Error(
    `${name} port already answers at ${url}. This suite uses dedicated ports so it never ` +
      'collides with an ordinary `pnpm dev` or a manual simulator-debug session — stop ' +
      'whatever is using it (a leftover run of this same suite is the most likely cause) ' +
      'and try again.',
  );
}

async function waitForHttp(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status < 500) return;
    } catch {
      // not up yet
    }
    if (Date.now() >= deadline)
      throw new Error(`${label} did not respond at ${url} within ${timeoutMs}ms`);
    await sleep(200);
  }
}

async function waitForBoot(sim: SimulatorClient, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let since: number | undefined;
  for (;;) {
    const { entries } = await sim.console(since);
    for (const entry of entries) {
      if (since === undefined || entry.id > since) since = entry.id;
      if (entry.message.includes('config source = stored')) throw new Error(STALE_CONFIG_MESSAGE);
      if (
        entry.message.includes('glasses page setup rejected') ||
        entry.message.includes('connect failed')
      ) {
        throw new Error(`simulator failed to boot the app: ${entry.message}`);
      }
      if (entry.message.includes('glasses started')) return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`timed out after ${timeoutMs}ms waiting for the app to boot`);
    }
    await sleep(150);
  }
}

function resolveRepoBin(name: string): string {
  return fileURLToPath(new URL(`../../../../node_modules/.bin/${name}`, import.meta.url));
}

function spawnLogged(
  command: string,
  args: string[],
  cwd: string,
  logPath: string,
  env?: NodeJS.ProcessEnv,
): ChildProcess {
  const log = createWriteStream(logPath, { flags: 'w' });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Makes this child the leader of its own new process group (POSIX) so
    // killChild can signal the whole tree, not just this direct process.
    // evenhub-simulator's own bin/index.js is a JS wrapper that execs the
    // real native GUI binary as ITS OWN child — a plain child.kill() only
    // reaches the wrapper, and the simulator window is left running
    // (confirmed: the wrapper process exits, the GUI process doesn't).
    detached: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

function killTree(pid: number, signal: NodeJS.Signals): void {
  try {
    if (process.platform === 'win32') {
      // No POSIX process groups on Windows; taskkill's /T walks the tree.
      spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
    } else {
      process.kill(-pid, signal); // negative pid = the whole process group
    }
  } catch {
    // Already exited, or the group is already gone — the 'exit' listener in
    // killChild resolves either way (or the SIGKILL follow-up fires).
  }
}

async function killChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const pid = child.pid;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    killTree(pid, 'SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) killTree(pid, 'SIGKILL');
    }, 3000);
  });
}

export default async function setup(): Promise<() => Promise<void>> {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  mkdirSync(ENV_DIR, { recursive: true });

  // A dedicated envDir (see vite.e2e.config.ts) that only ever contains this
  // generated file — never the developer's real apps/glasses/.env.local.
  const tenant = tenantId();
  writeFileSync(
    `${ENV_DIR}/.env.local`,
    [
      'VITE_NOTION_TOKEN=e2e-fixture-token',
      `VITE_NOTION_TASKS_DB=${tenant}`,
      `VITE_NOTION_NOTES_DB=${tenant}-notes`,
      `VITE_NOTION_PROJECTS_DB=${tenant}-projects`,
      `VITE_NOTION_TAGS_DB=${tenant}-tags`,
      '',
    ].join('\n'),
  );

  await Promise.all([
    assertPortFree('fixture server', `http://127.0.0.1:${FIXTURE_PORT}/__calls`),
    assertPortFree('vite', VITE_URL),
    assertPortFree('simulator automation', `${SIM_URL}/api/ping`),
  ]);

  let fixtureServer: Server | undefined;
  let viteProcess: ChildProcess | undefined;
  let simProcess: ChildProcess | undefined;

  try {
    fixtureServer = await startFixtureServer(FIXTURE_PORT);

    viteProcess = spawnLogged(
      resolveRepoBin('vite'),
      ['--config', VITE_CONFIG],
      GLASSES_ROOT,
      `${RUNTIME_DIR}/vite.log`,
    );
    await waitForHttp(VITE_URL, 20_000, 'vite dev server');

    const simEnv = { ...process.env };
    if (process.env.UB_E2E_SIM_DEBUG) simEnv.RUST_LOG = simEnv.RUST_LOG ?? 'debug';
    const simArgs = [VITE_URL, '--automation-port', String(SIM_PORT)];
    if (process.env.CI) simArgs.push('--no-aid');
    simProcess = spawnLogged(
      resolveRepoBin('evenhub-simulator'),
      simArgs,
      REPO_ROOT,
      `${RUNTIME_DIR}/simulator.log`,
      simEnv,
    );

    const sim = new SimulatorClient(SIM_URL);
    await waitForHttp(`${SIM_URL}/api/ping`, 20_000, 'simulator automation API');
    await waitForBoot(sim);
  } catch (err) {
    await killChild(simProcess);
    await killChild(viteProcess);
    if (fixtureServer) await stopFixtureServer(fixtureServer);
    throw err;
  }

  const capturedFixture = fixtureServer;
  const capturedVite = viteProcess;
  const capturedSim = simProcess;

  return async function teardown(): Promise<void> {
    await killChild(capturedSim);
    await killChild(capturedVite);
    if (capturedFixture) await stopFixtureServer(capturedFixture);
  };
}
