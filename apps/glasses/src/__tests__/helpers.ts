import { List_ItemEvent, Text_ItemEvent } from '@evenrealities/even_hub_sdk';
import { vi } from 'vitest';
import { state } from '../state';

// ---------------------------------------------------------------------------
// Mock bridge factory
// ---------------------------------------------------------------------------

export function makeMockBridge() {
  return {
    createStartUpPageContainer: vi.fn().mockResolvedValue(0),
    rebuildPageContainer: vi.fn().mockResolvedValue(true),
    textContainerUpgrade: vi.fn().mockResolvedValue(true),
    shutDownPageContainer: vi.fn().mockResolvedValue(true),
    audioControl: vi.fn().mockResolvedValue(true),
    setLocalStorage: vi.fn().mockResolvedValue(true),
    getLocalStorage: vi.fn().mockResolvedValue(''),
  };
}

// ---------------------------------------------------------------------------
// State reset
// ---------------------------------------------------------------------------

export function resetState() {
  state.screen = 'menu';
  state.startupRendered = true; // skip createStartUpPageContainer path
  state.lists = {};
  state.recording = 'idle';
  state.createdTaskName = '';
  state.pendingTranscript = '';
  state.loading = false;
  state.spinnerFrame = '';
  state.errorMessage = '';
  state.pendingAction = null;
  state.selectedTask = null;
  state.taskMetadata = null;
  state.selectedNote = null;
  state.noteMetadata = null;
  state.pageContent = null;
  state.actionToast = null;
  state.selectedProject = null;
}

// ---------------------------------------------------------------------------
// Promise flushing
// Drains the microtask queue several levels deep so that chained .then()
// callbacks (from mocked resolved promises) all complete before we assert.
// ---------------------------------------------------------------------------

export async function flushPromises(depth = 5) {
  for (let i = 0; i < depth; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Minimal EvenHubEvent constructors
// ---------------------------------------------------------------------------

export function clickEvent() {
  // eventType 0 (CLICK_EVENT) is omitted by protobuf → undefined on textEvent
  return { textEvent: new Text_ItemEvent({}) };
}

/**
 * Native-list click carrying the firmware's reported selection index
 * (Menu/Today/Inbox, once in list mode). Same CLICK_EVENT=0-omission quirk
 * as clickEvent() — eventType is left unset.
 */
export function listClickEvent(index: number) {
  return { listEvent: new List_ItemEvent({ currentSelectItemIndex: index }) };
}

/**
 * Native-list click on the FIRST item, as the firmware bridge actually
 * reports it: proto3 JSON encoding drops fields at their zero default, so
 * currentSelectItemIndex is omitted from the payload entirely rather than
 * sent as 0. listClickEvent(0) above does not reproduce this — use this
 * helper to test the SDK's zero-omission quirk specifically.
 */
export function listClickEventFirstItemOmittedIndex() {
  return { listEvent: new List_ItemEvent({}) };
}

export function scrollUpEvent() {
  return { textEvent: new Text_ItemEvent({ eventType: 1 }) }; // SCROLL_TOP_EVENT
}

export function scrollDownEvent() {
  return { textEvent: new Text_ItemEvent({ eventType: 2 }) }; // SCROLL_BOTTOM_EVENT
}

export function doubleTapEvent() {
  return { textEvent: new Text_ItemEvent({ eventType: 3 }) }; // DOUBLE_CLICK_EVENT
}
