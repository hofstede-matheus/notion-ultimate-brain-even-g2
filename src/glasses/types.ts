import type { GlassNavState } from 'even-toolkit/types'

export type { GlassNavState }

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
  display: (snapshot: S, nav: GlassNavState) => ScreenDisplay
  action: (action: AppGlassAction, nav: GlassNavState, snapshot: S, ctx: C) => GlassNavState
}
