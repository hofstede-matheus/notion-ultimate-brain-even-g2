import type { AppState } from '../state'
import type { GlassCtx } from './context'
import type { Screen, ScreenDisplay, AppGlassAction, GlassNavState } from './types'
import { menuScreen } from './screens/menu'
import { overdueScreen } from './screens/overdue'
import { todayScreen } from './screens/today'
import { inboxScreen } from './screens/inbox'
import { addTaskScreen } from './screens/add-task'

const SCREENS: Record<string, Screen<AppState, GlassCtx>> = {
  menu: menuScreen,
  overdue: overdueScreen,
  today: todayScreen,
  inbox: inboxScreen,
  'add-task': addTaskScreen,
}
const FALLBACK = 'menu'

function getScreen(name: string): Screen<AppState, GlassCtx> {
  return SCREENS[name] ?? SCREENS[FALLBACK]!
}

export const router = {
  toDisplayData(snapshot: AppState, nav: GlassNavState): ScreenDisplay {
    return getScreen(nav.screen).display(snapshot, nav)
  },
  onGlassAction(action: AppGlassAction, nav: GlassNavState, snapshot: AppState, ctx: GlassCtx): GlassNavState {
    return getScreen(nav.screen).action(action, nav, snapshot, ctx)
  },
}
