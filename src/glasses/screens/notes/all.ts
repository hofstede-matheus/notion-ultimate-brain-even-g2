import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const allNotesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-all',
  parent: 'notes-menu',
  title: 'ALL NOTES',
  emptyMessage: 'No notes.',
})
