import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const boardScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Board',
  'projects-menu',
)
