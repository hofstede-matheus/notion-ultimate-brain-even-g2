import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const plannedScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Planned',
  'projects-menu',
)
