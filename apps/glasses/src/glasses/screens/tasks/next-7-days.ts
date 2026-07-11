import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const next7DaysScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tasks-next-7-days',
  parent: 'tasks-menu',
  title: 'NEXT 7 DAYS',
  emptyMessage: 'No tasks in the next 7 days.',
})
