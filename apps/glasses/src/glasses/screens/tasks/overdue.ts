import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen, getOverdueFlatTasks } from '../shared'

export const overdueScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'overdue',
  parent: 'tasks-menu',
  title: 'OVERDUE',
  emptyMessage: "Nothing overdue! You're all caught up.",
  loadingMessage: 'Fetching tasks...',
  selectItems: getOverdueFlatTasks,
  onSelect: 'task',
})
