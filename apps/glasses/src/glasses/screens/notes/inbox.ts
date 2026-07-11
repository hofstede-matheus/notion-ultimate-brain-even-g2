import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const notesInboxScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-inbox',
  parent: 'notes-menu',
  title: 'NOTES INBOX',
  emptyMessage: 'Your notes inbox is empty.',
})
