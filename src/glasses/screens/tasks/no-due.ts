import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const noDueScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'No Due',
  'tasks-menu',
)
