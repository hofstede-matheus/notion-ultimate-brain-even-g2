import type { AppState, ScreenName } from '../state';

/**
 * What a screen wants rendered. 'list' screens (Today/Inbox with >=1 items)
 * render as a header text container + a native G2 list widget
 * (ListContainerProperty); every other case (menu, add-task, loading,
 * empty) is a single full-page text container.
 */
export type ScreenDisplay =
  | { mode: 'text'; content: string }
  | { mode: 'list'; header: string; items: string[] };

/**
 * Extends the toolkit's GlassAction shape with native-list selection data,
 * populated from event.listEvent.currentSelectItemIndex/currentSelectItemName
 * when the triggering event came from a ListContainerProperty (Today/Inbox).
 * Left undefined for plain text-container clicks (Menu, Add Task).
 */
export type AppGlassAction =
  | { type: 'HIGHLIGHT_MOVE'; direction: 'up' | 'down' }
  | { type: 'SELECT_HIGHLIGHTED'; itemIndex?: number; itemName?: string }
  | { type: 'GO_BACK' };

export interface ScreenModule {
  display: (snapshot: AppState) => ScreenDisplay;
  action: (action: AppGlassAction, snapshot: AppState, ctx: GlassCtx) => void;
}

/**
 * Side-effect surface handed to screen action() handlers. Each entry point
 * mirrors the high-level user gesture (navigate, shutdown, enter a data
 * screen, start/cancel voice recording) so screens stay free of raw SDK
 * and module-state plumbing.
 */
export interface GlassCtx {
  navigate(screen: ScreenName): void;
  shutdown(): void;
  stopSpinner(): void;
  /** Cache-then-fetch entry point for every list-view screen. */
  enterView(screen: ScreenName): void;
  startRecording(): void;
  cancelRecordingAndGoBack(): void;
  confirmAddTask(): Promise<void>;
  discardAddTask(): void;
  openConfirm(
    action: 'markDone' | 'delete',
    itemId: string,
    itemName: string,
    returnTo: ScreenName,
  ): void;
  confirmAction(): Promise<void>;
  dismissConfirm(): void;
  dismissActionToast(): void;
  openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void;
  enterTaskMetadata(): void;
  openNoteActions(noteId: string, noteName: string, returnTo: ScreenName): void;
  /** A note's metadata is just its Project — Notes have no Due date. */
  enterNoteMetadata(): void;
  /** Turns a list screen `delta` pages, clamped to `[0, totalPages - 1]`. */
  turnListPage(screen: ScreenName, delta: number, totalPages: number): void;
  /** Reads any Notion page — a task or a note, from its action menu. `returnTo` is wherever a double-tap should land. */
  openPage(pageId: string, title: string, returnTo: ScreenName): void;
  /** Moves the page reader `delta` screenfuls, clamped to the document. */
  turnPage(delta: number): void;
  openProjectDetail(projectId: string, projectName: string, returnTo: ScreenName): void;
}

/** A single entry in a menu screen — `target` undefined means the row is a no-op stub. */
export interface MenuItem {
  label: string;
  target?: ScreenName;
}

/** Definition of a menu screen: title, optional parent (root if absent), and its items. */
export interface MenuDef {
  title: string;
  parent?: ScreenName;
  items: MenuItem[];
}
