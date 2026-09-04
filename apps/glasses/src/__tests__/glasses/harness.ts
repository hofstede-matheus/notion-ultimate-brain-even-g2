/**
 * Test harness — mounts a fresh GlassCtx (built by production's own
 * createGlassCtx(), reading whatever ../../api / ../../cache / ../../stt
 * modules the calling test file vi.mock'd) plus a clean AppState, then hands
 * back a tiny surface for "dispatch an action, assert the state mutation and
 * the render output" tests.
 */

import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk';
import { resetBridgeQueue, whenIdle } from '../../glasses/bridge-queue';
import { createGlassCtx } from '../../glasses/glass-ctx';
import { router } from '../../glasses/router';
import type { AppGlassAction, ContextMenuItem } from '../../glasses/types';
import { setBridge, state } from '../../state';
import { type MockBridge, makeMockBridge } from './fakes';

/** Resets the shared state singleton to a known baseline before each test. */
export function resetState(): void {
  state.screen = 'menu';
  state.startupRendered = true;
  state.lists = {};
  state.listPages = {};
  state.lastHighlightedIndex = {};
  state.pendingAction = null;
  state.selectedTask = null;
  state.dueDatePicker = null;
  state.taskDetails = null;
  state.selectedNote = null;
  state.noteDetails = null;
  state.projectPicker = null;
  state.pageContent = null;
  state.actionToast = null;
  state.selectedProject = null;
  state.selectedTag = null;
  state.recording = 'idle';
  state.createdTaskName = '';
  state.pendingTranscript = '';
  // Most tests exercise the recording flow, so the default baseline is a
  // configured, working backend. Tests for the unconfigured screens set this
  // themselves.
  state.voice = 'ready';
  state.loading = false;
  state.spinnerFrame = '';
  state.errorMessage = '';
  state.listStatus = {};
  state.configSuspect = false;
}

/**
 * Drains pending async work: `depth` raw microtask ticks (for non-bridge
 * chains — mocked API/cache fetches, `enterView`'s finally-triggered
 * re-render), then `whenIdle()` to fully drain the bridge-queue chain
 * (whose depth varies with how many bridge calls a given render issues, so
 * a fixed tick count alone can't reliably catch up), then a few more raw
 * ticks in case a bridge call's resolution triggered further non-bridge
 * async work.
 */
export async function flushPromises(depth = 5): Promise<void> {
  for (let i = 0; i < depth; i++) await Promise.resolve();
  await whenIdle();
  for (let i = 0; i < depth; i++) await Promise.resolve();
}

export function mount() {
  resetState();
  resetBridgeQueue();

  const bridge: MockBridge = makeMockBridge();
  setBridge(bridge as unknown as EvenAppBridge);

  const ctx = createGlassCtx();

  return {
    state,
    ctx,
    bridge,
    /** Dispatches an action into the current screen, exactly as onGlassAction does in production. */
    dispatch(action: AppGlassAction): void {
      router.onGlassAction(action, state, ctx);
    },
    /** Dispatches an OS contextual-menu selection, exactly as onMenuItemClick does in production. */
    menuClick(itemID: number): void {
      router.onMenuItemClick(itemID, state, ctx);
    },
    /** What would be drawn right now — the pure "rendered on device" check. */
    render() {
      return router.toDisplayData(state);
    },
    /**
     * Replays `event` through the callback captured by the most recent
     * `bridge.onEvenHubEvent(...)` subscription — call `startGlasses()`
     * first so there's a handler to replay into.
     */
    emit(event: EvenHubEvent): void {
      const handler = bridge.onEvenHubEvent.mock.calls.at(-1)?.[0] as
        | ((e: EvenHubEvent) => void)
        | undefined;
      if (!handler) {
        throw new Error(
          'emit() called before onEvenHubEvent was subscribed — call startGlasses() first',
        );
      }
      handler(event);
    },
    settle: flushPromises,
  };
}

// ---------------------------------------------------------------------------
// Tiny AppGlassAction builders
// ---------------------------------------------------------------------------

export function select(itemIndex?: number, itemName?: string): AppGlassAction {
  return { type: 'SELECT_HIGHLIGHTED', itemIndex, itemName };
}

export function back(): AppGlassAction {
  return { type: 'GO_BACK' };
}

export function move(direction: 'up' | 'down'): AppGlassAction {
  return { type: 'HIGHLIGHT_MOVE', direction };
}

/** The gesture that raises the OS contextual menu — same shape as select(), since the menu is
 * page-scoped and still needs to know which row was highlighted. */
export function longPress(itemIndex?: number, itemName?: string): AppGlassAction {
  return { type: 'LONG_PRESS', itemIndex, itemName };
}

/**
 * Looks up a contextual-menu item's id by its label — for tests that need to
 * simulate `h.menuClick(id)`. Throws immediately rather than returning
 * `number | undefined`, so a typo in a test's label fails loudly at import
 * time instead of silently compiling to `undefined`.
 */
export function menuItemId(menu: ContextMenuItem[], label: string): number {
  const item = menu.find((i) => i.label === label);
  if (!item) throw new Error(`no menu item labelled "${label}"`);
  return item.id;
}
