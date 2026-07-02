import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const next7DaysScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Next 7 Days',
  'tasks-menu',
)
