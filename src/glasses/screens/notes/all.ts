import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const allNotesScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'All',
  'notes-menu',
)
