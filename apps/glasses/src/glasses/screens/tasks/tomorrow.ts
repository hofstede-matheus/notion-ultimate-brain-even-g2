import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const tomorrowScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tasks-tomorrow',
  parent: 'tasks-menu',
  title: 'TOMORROW',
  emptyMessage: 'No tasks due tomorrow.',
})
