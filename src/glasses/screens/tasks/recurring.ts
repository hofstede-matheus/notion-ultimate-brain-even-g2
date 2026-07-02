import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const recurringScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Recurring',
  'tasks-menu',
)
