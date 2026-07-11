import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const voiceNotesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-voice',
  parent: 'notes-menu',
  title: 'VOICE NOTES',
  emptyMessage: 'No voice notes.',
})
