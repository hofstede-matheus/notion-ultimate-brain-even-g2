import type { AppState } from '../../../state'
import type { Task } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const projectTasksScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'project-tasks',
  parent: 'project-detail',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — TASKS`,
  emptyMessage: 'No tasks in this project.',
  formatLabel: (item) => `${(item as Task).status === 'Done' ? '[v] ' : '[ ] '}${item.name}`,
})
