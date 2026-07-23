/**
 * Test harness — mounts a fresh GlassCtx (built by production's own
 * createGlassCtx(), reading whatever ../../api / ../../cache / ../../stt
 * modules the calling test file vi.mock'd) plus a clean AppState, then hands
 * back a tiny surface for "dispatch an action, assert the state mutation and
 * the render output" tests.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { createGlassCtx } from '../../glasses/glass-ctx';
import { router } from '../../glasses/router';
import type { AppGlassAction } from '../../glasses/types';
import { setBridge, state } from '../../state';
import { type MockBridge, makeMockBridge } from './fakes';

/** Resets the shared state singleton to a known baseline before each test. */
export function resetState(): void {
  state.screen = 'menu';
  state.startupRendered = true;
  state.lists = {};
  state.listPages = {};
  state.pendingAction = null;
  state.selectedTask = null;
  state.taskMetadata = null;
  state.selectedNote = null;
  state.noteMetadata = null;
  state.pageContent = null;
  state.actionToast = null;
  state.selectedProject = null;
  state.selectedTag = null;
  state.recording = 'idle';
  state.createdTaskName = '';
  state.pendingTranscript = '';
  state.loading = false;
  state.spinnerFrame = '';
  state.errorMessage = '';
}

/** Drains the microtask queue `depth` levels deep — enough for chained awaits on a mock's resolved promises to settle. */
export async function flushPromises(depth = 5): Promise<void> {
  for (let i = 0; i < depth; i++) await Promise.resolve();
}

export function mount() {
  resetState();

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
    /** What would be drawn right now — the pure "rendered on device" check. */
    render() {
      return router.toDisplayData(state);
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
