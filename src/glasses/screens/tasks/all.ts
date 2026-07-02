import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const allTasksScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'All',
  'tasks-menu',
)
