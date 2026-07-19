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
    taskId: string,
    taskName: string,
    returnTo: ScreenName,
  ): void;
  confirmAction(): Promise<void>;
  dismissConfirm(): void;
  dismissActionToast(): void;
  openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void;
  enterTaskMetadata(): void;
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
