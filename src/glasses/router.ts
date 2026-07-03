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
import { markDoneConfirmScreen } from './screens/tasks/mark-done-confirm'
import { markDoneToastScreen } from './screens/tasks/mark-done-toast'
import { next7DaysScreen } from './screens/tasks/next-7-days'
import { tomorrowScreen } from './screens/tasks/tomorrow'
import { notesInboxScreen } from './screens/notes/inbox'
import { notesFavoritesScreen } from './screens/notes/favorites'
import { notesByTagScreen } from './screens/notes/by-tag'
import { notesListScreen } from './screens/notes/notes'
import { meetingsScreen } from './screens/notes/meetings'
import { notesByProjectScreen } from './screens/notes/by-project'
import { clipsScreen } from './screens/notes/clips'
import { voiceNotesScreen } from './screens/notes/voice'
import { journalScreen } from './screens/notes/journal'
import { allNotesScreen } from './screens/notes/all'
import { activeScreen as projectsActiveScreen } from './screens/projects/active'
import { plannedScreen } from './screens/projects/planned'
import { boardScreen } from './screens/projects/board'
import { archivedScreen } from './screens/projects/archived'
import { recentTagsScreen } from './screens/tags/recent'
import { tagsFavoritesScreen } from './screens/tags/favorites'
import { tagsAzScreen } from './screens/tags/a-z'
import { tagsTypesScreen } from './screens/tags/types'
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
  'tasks-next-7-days': next7DaysScreen,
  'tasks-tomorrow': tomorrowScreen,
  'notes-inbox': notesInboxScreen,
  'notes-favorites': notesFavoritesScreen,
  'notes-by-tag': notesByTagScreen,
  'notes-list': notesListScreen,
  'notes-meetings': meetingsScreen,
  'notes-by-project': notesByProjectScreen,
  'notes-clips': clipsScreen,
  'notes-voice': voiceNotesScreen,
  'notes-journal': journalScreen,
  'notes-all': allNotesScreen,
  'projects-active': projectsActiveScreen,
  'projects-planned': plannedScreen,
  'projects-board': boardScreen,
  'projects-archived': archivedScreen,
  'tags-recent': recentTagsScreen,
  'tags-favorites': tagsFavoritesScreen,
  'tags-a-z': tagsAzScreen,
  'tags-types': tagsTypesScreen,
  'mark-done-confirm': markDoneConfirmScreen,
  'mark-done-toast': markDoneToastScreen,
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
