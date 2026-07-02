import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const activeScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Active',
  'projects-menu',
)
