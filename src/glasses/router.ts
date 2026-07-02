import type { AppState } from '../state'
import type { GlassCtx } from './types'
import type { Screen, ScreenDisplay, AppGlassAction, GlassNavState } from './types'
import { menuScreen } from './screens/menu'
import { tasksMenuScreen } from './screens/tasks/menu'
import { notesMenuScreen } from './screens/notes/menu'
import { projectsMenuScreen } from './screens/projects/menu'
import { tagsMenuScreen } from './screens/tags/menu'
import { overdueScreen } from './screens/tasks/overdue'
import { todayScreen } from './screens/tasks/today'
import { inboxScreen } from './screens/tasks/inbox'
import { addTaskScreen } from './screens/tasks/add-task'
import { FALLBACK_SCREEN } from './constants'

const SCREENS: Record<string, Screen<AppState, GlassCtx>> = {
  menu: menuScreen,
  'tasks-menu': tasksMenuScreen,
  'notes-menu': notesMenuScreen,
  'projects-menu': projectsMenuScreen,
  'tags-menu': tagsMenuScreen,
  overdue: overdueScreen,
  today: todayScreen,
  inbox: inboxScreen,
  'add-task': addTaskScreen,
}

function getScreen(name: string): Screen<AppState, GlassCtx> {
  return SCREENS[name] ?? SCREENS[FALLBACK_SCREEN]!
}

export const router = {
  toDisplayData(snapshot: AppState, nav: GlassNavState): ScreenDisplay {
    return getScreen(nav.screen).display(snapshot, nav)
  },
  onGlassAction(action: AppGlassAction, nav: GlassNavState, snapshot: AppState, ctx: GlassCtx): GlassNavState {
    return getScreen(nav.screen).action(action, nav, snapshot, ctx)
  },
}
