import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { litPixelRatio } from './png';
import type { ConsoleEntry, InputAction } from './simulator';
import { SimulatorClient } from './simulator';

/**
 * The app-level driver every spec is written against. All waiting is
 * predicate-based polling of console lines — no sleep() standing in for
 * "wait until done". The two sleeps that do exist are documented, bounded
 * throttle windows the app itself enforces (see SCROLL_COOLDOWN_MS below),
 * not a substitute for a real wait.
 */

// Mirrors events/resolve.ts's SCROLL_COOLDOWN_MS — a second swipe inside this
// window is silently dropped by the app, not queued, so the driver must not
// send one faster than the hardware could.
const SWIPE_COOLDOWN_MS = 320;
const INPUT_SETTLE_MS = 40;
/**
 * Extra settle time after selecting a contextual-menu item, before any
 * further input. Confirmed against simulator 0.9.3: the overlay's own
 * dismissal on selection is not synchronous with the app's state
 * transition — a tap that follows immediately (within `INPUT_SETTLE_MS`)
 * can land on the still-showing overlay instead of the screen behind it,
 * even though the app's own NAV log line already shows the new screen.
 */
const CONTEXT_MENU_CLOSE_SETTLE_MS = 500;

const SCREENSHOT_DIR = fileURLToPath(new URL('../.runtime/screenshots', import.meta.url));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dumpPng(buffer: Buffer, label: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = `${SCREENSHOT_DIR}/${label}-${Date.now()}.png`;
  writeFileSync(path, buffer);
  return path;
}

/** Throws with the dump path in the message when too little of the framebuffer is lit. */
export function assertLit(buffer: Buffer, label: string, minRatio = 0.001): void {
  const ratio = litPixelRatio(buffer);
  if (ratio <= minRatio) {
    const path = dumpPng(buffer, label);
    throw new Error(
      `assertLit(${label}): only ${(ratio * 100).toFixed(3)}% of pixels lit ` +
        `(expected > ${(minRatio * 100).toFixed(3)}%) — dumped to ${path}`,
    );
  }
}

const RENDER_SCREEN_RE = /RENDER\s+full mode=\S+ screen=(\S+)/;

// Lines that mean "the SDK rejected or failed to paint a payload" — the class
// of bug a mocked bridge (every unit test) cannot see at all.
const ERROR_LINE_RE =
  /rejected|send failed|startup rejected|^\[uncaught]|^\[unhandledrejection]|^\[fetch]/;

export class AppDriver {
  /** Tracks the OS contextual-menu overlay's open/closed state — `context_menu`
   * in the simulator's automation API TOGGLES it, so callers can't post it
   * unconditionally without risking closing it right back. */
  private contextMenuOpen = false;

  constructor(private readonly sim: SimulatorClient) {}

  async ping(): Promise<boolean> {
    return this.sim.ping();
  }

  /** Highest console entry id seen so far — snapshot before an action to scope a later assertNoErrors/waitForLine. */
  async latestId(): Promise<number> {
    const { entries } = await this.sim.console();
    return entries.reduce((max, e) => Math.max(max, e.id), -1);
  }

  /**
   * Polls until a console message matches `pattern`. Not a sleep: retries on
   * a short interval until the line appears or `timeoutMs` elapses.
   */
  async waitForLine(
    pattern: RegExp,
    opts: { timeoutMs?: number; from?: number } = {},
  ): Promise<ConsoleEntry> {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    const deadline = Date.now() + timeoutMs;
    let since = opts.from;
    for (;;) {
      const { entries } = await this.sim.console(since);
      for (const entry of entries) {
        if (since === undefined || entry.id > since) since = entry.id;
        if (pattern.test(entry.message)) return entry;
      }
      if (Date.now() >= deadline) {
        throw new Error(`waitForLine: timed out after ${timeoutMs}ms waiting for ${pattern}`);
      }
      await sleep(120);
    }
  }

  /**
   * A single non-waiting scan of the full console buffer — for asserting
   * something that already happened (e.g. boot's own render), where
   * waitForLine's polling would just time out with nothing new to find.
   */
  async hasLine(pattern: RegExp): Promise<ConsoleEntry | undefined> {
    const { entries } = await this.sim.console();
    return entries.find((entry) => pattern.test(entry.message));
  }

  /** The screen named in the most recent `RENDER full … screen=X` trace line. */
  async currentScreen(): Promise<string> {
    const { entries } = await this.sim.console();
    let last: string | undefined;
    for (const entry of entries) {
      const match = RENDER_SCREEN_RE.exec(entry.message);
      if (match?.[1]) last = match[1];
    }
    if (!last) throw new Error('currentScreen: no RENDER line has appeared yet');
    return last;
  }

  /** Fails with the offending lines listed if any error/warn/rejection appeared after `fromId`. */
  async assertNoErrors(fromId: number): Promise<void> {
    const { entries } = await this.sim.console(fromId);
    const bad = entries.filter(
      (e) => e.level === 'error' || e.level === 'warn' || ERROR_LINE_RE.test(e.message),
    );
    if (bad.length > 0) {
      const lines = bad.map((e) => `  #${e.id} [${e.level}] ${e.message}`).join('\n');
      throw new Error(
        `assertNoErrors: ${bad.length} error/warn line(s) after #${fromId}:\n${lines}`,
      );
    }
  }

  private async input(action: InputAction): Promise<void> {
    await this.sim.input(action);
    await sleep(INPUT_SETTLE_MS);
  }

  async tap(): Promise<void> {
    await this.input('click');
  }

  /** Double-tap = back everywhere except the root menu, where it shuts the app down — see resetToRootMenu. */
  async back(): Promise<void> {
    await this.input('double_click');
  }

  async swipeUp(): Promise<void> {
    await this.input('up');
    await sleep(SWIPE_COOLDOWN_MS);
  }

  async swipeDown(): Promise<void> {
    await this.input('down');
    await sleep(SWIPE_COOLDOWN_MS);
  }

  /** Sustained-press start (SDK 0.0.14+ / simulator 0.9.1+) — the gesture that raises the OS
   * contextual menu on real hardware. Fires the app's LONG_PRESS_EVENT, but — confirmed against
   * simulator 0.9.3 — does NOT by itself make the overlay appear or become interactive in the
   * simulator; see holdToOpenContextMenu(). */
  async longPress(): Promise<void> {
    await this.input('long_press');
  }

  /** Sustained-press release — paired with longPress(). */
  async longPressRelease(): Promise<void> {
    await this.input('long_press_release');
  }

  /**
   * The full gesture a wearer performs to raise the contextual menu on a
   * highlighted row: `long_press` + `long_press_release` (so the app fires
   * LONG_PRESS_EVENT/RELEASE and stashes the row — see
   * glasses/context-menu.ts, state.lastHighlightedIndex), THEN
   * `context_menu` to actually raise the simulator's overlay so `up`/`down`/
   * `click` reach it. On real hardware a single physical long-press is
   * expected to do both at once; the simulator's automation API keeps them
   * separate (confirmed against 0.9.3 — `long_press` alone leaves the
   * screenshot showing the underlying list, unchanged).
   */
  async holdToOpenContextMenu(): Promise<void> {
    await this.longPress();
    await this.longPressRelease();
    await this.openContextMenu();
  }

  /**
   * Toggles the simulator's contextual-menu overlay directly via
   * `{ action: 'context_menu' }`, tracking open/closed state so repeated
   * calls don't accidentally close what they meant to open. Most specs want
   * `holdToOpenContextMenu()` instead, which also fires the real gesture
   * events the app acts on; call this directly only to force a known state
   * (e.g. after a boot/reset, or to force-close per selectContextMenuItem's
   * caveat below).
   */
  async openContextMenu(): Promise<void> {
    if (this.contextMenuOpen) return;
    await this.input('context_menu');
    this.contextMenuOpen = true;
  }

  async closeContextMenu(): Promise<void> {
    if (!this.contextMenuOpen) return;
    await this.input('context_menu');
    this.contextMenuOpen = false;
  }

  /**
   * Moves the contextual-menu highlight down `n` times, then selects it —
   * the menu must already be open (see holdToOpenContextMenu()). Waits
   * CONTEXT_MENU_CLOSE_SETTLE_MS afterward — the overlay's own dismissal
   * lags the app's state transition, so a caller's next input can otherwise
   * land on the still-showing overlay instead of the screen behind it (see
   * that constant's doc comment).
   */
  async selectContextMenuItem(downCount: number): Promise<void> {
    for (let i = 0; i < downCount; i++) await this.swipeDown();
    await this.tap();
    await sleep(CONTEXT_MENU_CLOSE_SETTLE_MS);
    this.contextMenuOpen = false;
  }

  /**
   * Backs out to the root menu, checking the screen before every tap — a
   * double-tap AT the root menu is shutDownPageContainer(1) and kills the app
   * for the rest of the run, so this must never fire one once already there.
   */
  async resetToRootMenu(): Promise<void> {
    const maxBacks = 12; // deepest tree today is 5 (project → tasks → to-do), plus slack
    for (let i = 0; i < maxBacks; i++) {
      const screen = await this.currentScreen();
      if (screen === 'menu') return;
      const cursor = await this.latestId();
      await this.back();
      // Wait for the repaint that back triggered before re-reading the
      // screen. Without this, currentScreen() can still be returning the
      // pre-back RENDER line, the loop concludes it hasn't left yet, and
      // sends another back — which at the root menu is shutDownPageContainer.
      await this.waitForLine(/RENDER full/, { from: cursor, timeoutMs: 5000 }).catch(
        () => undefined,
      );
    }
    const finalScreen = await this.currentScreen();
    if (finalScreen !== 'menu') {
      throw new Error(
        `resetToRootMenu: still on "${finalScreen}" after ${maxBacks} back-taps — refusing to ` +
          'guess further (one more double-tap here could be the root shutdown gesture)',
      );
    }
  }

  async screenshotGlasses(): Promise<Buffer> {
    return this.sim.screenshotGlasses();
  }

  async screenshotWebview(): Promise<Buffer> {
    return this.sim.screenshotWebview();
  }
}

export function makeDriver(baseUrl: string): AppDriver {
  return new AppDriver(new SimulatorClient(baseUrl));
}
