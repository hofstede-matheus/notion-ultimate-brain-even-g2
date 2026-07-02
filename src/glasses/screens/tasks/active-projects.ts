import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const activeProjectsScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Active Projects',
  'tasks-menu',
)
