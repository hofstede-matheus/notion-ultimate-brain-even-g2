import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const notesListScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-list',
  parent: 'notes-menu',
  title: 'NOTES',
  emptyMessage: 'No notes.',
})
