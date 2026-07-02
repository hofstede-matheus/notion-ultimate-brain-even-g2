import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const doneScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Done',
  'tasks-menu',
)
