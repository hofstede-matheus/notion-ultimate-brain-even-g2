import type { Screen as ScreenName } from '../state'

/**
 * What a screen wants rendered. 'list' screens (Today/Inbox with >=1 items)
 * render as a header text container + a native G2 list widget
 * (ListContainerProperty); every other case (menu, add-task, loading,
 * empty) is a single full-page text container.
 */
export type ScreenDisplay =
  | { mode: 'text'; content: string }
  | { mode: 'list'; header: string; items: string[] }

/**
 * Extends the toolkit's GlassAction shape with native-list selection data,
 * populated from event.listEvent.currentSelectItemIndex/currentSelectItemName
 * when the triggering event came from a ListContainerProperty (Today/Inbox).
 * Left undefined for plain text-container clicks (Menu, Add Task).
 */
export type AppGlassAction =
  | { type: 'HIGHLIGHT_MOVE'; direction: 'up' | 'down' }
  | { type: 'SELECT_HIGHLIGHTED'; itemIndex?: number; itemName?: string }
  | { type: 'GO_BACK' }

export interface Screen<S, C> {
  display: (snapshot: S) => ScreenDisplay
  action: (action: AppGlassAction, snapshot: S, ctx: C) => void
}

/**
 * Side-effect surface handed to screen action() handlers. Each entry point
 * mirrors the high-level user gesture (navigate, shutdown, enter a data
 * screen, start/cancel voice recording) so screens stay free of raw SDK
 * and module-state plumbing.
 */
export interface GlassCtx {
  navigate(screen: ScreenName): void
  shutdown(): void
  stopSpinner(): void
  /** Cache-then-fetch entry point for every list-view screen (see context.ts's VIEW_FETCHERS). */
  enterView(screen: ScreenName): void
  startRecording(): void
  cancelRecordingAndGoBack(): void
  confirmAddTask(): Promise<void>
  discardAddTask(): void
  openMarkDoneConfirm(taskId: string, taskName: string, returnTo: ScreenName): void
  confirmMarkDone(): Promise<void>
  dismissMarkDoneConfirm(): void
  dismissToastAndReturn(): void
  openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void
  enterTaskMetadata(): void
  openDeleteConfirm(): void
  dismissDeleteConfirm(): void
  confirmDelete(): Promise<void>
  dismissDeleteToastAndReturn(): void
  openProjectDetail(projectId: string, projectName: string, returnTo: ScreenName): void
}

/** A single entry in a menu screen — `target` undefined means the row is a no-op stub. */
export interface MenuItem {
  label: string
  target?: ScreenName
}

/** Definition of a menu screen: title, optional parent (root if absent), and its items. */
export interface MenuDef {
  title: string
  parent?: ScreenName
  items: MenuItem[]
}
