import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const notesListScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Notes',
  'notes-menu',
)
