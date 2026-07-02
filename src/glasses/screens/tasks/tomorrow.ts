import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const tomorrowScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Tomorrow',
  'tasks-menu',
)
