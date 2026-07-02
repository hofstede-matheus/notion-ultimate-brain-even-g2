import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const notesInboxScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Inbox',
  'notes-menu',
)
