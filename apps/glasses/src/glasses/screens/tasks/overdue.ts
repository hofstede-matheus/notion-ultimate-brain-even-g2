import type { ScreenModule } from '../../types'
import { makeListScreen, getOverdueFlatTasks } from '../shared'

export const overdueScreen: ScreenModule = makeListScreen({
  screen: 'overdue',
  parent: 'tasks-menu',
  title: 'OVERDUE',
  emptyMessage: "Nothing overdue! You're all caught up.",
  loadingMessage: 'Fetching tasks...',
  selectItems: getOverdueFlatTasks,
  onSelect: 'task',
})
