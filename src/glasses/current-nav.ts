import type { GlassNavState } from 'even-toolkit/types'
import { state } from '../state'

/**
 * GlassScreen<S,C> requires a GlassNavState per call, but `state` remains the
 * single source of truth for screen + per-screen cursor (screens write cursor
 * changes back into `state` directly — see screens/*.ts). This packages the
 * cursor for whichever screen is currently active into the shape the router
 * expects, recomputed fresh before every dispatch/render.
 */
export function currentNav(): GlassNavState {
  const highlightedIndex =
    state.screen === 'menu' ? state.menuSelectedIndex :
    state.screen === 'overdue' ? state.overdueSelectedIndex :
    state.screen === 'today' ? state.todaySelectedIndex :
    state.screen === 'inbox' ? state.inboxSelectedIndex :
    0
  return { screen: state.screen, highlightedIndex }
}
