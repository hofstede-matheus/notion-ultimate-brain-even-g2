import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const meetingsScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Meetings',
  'notes-menu',
)
