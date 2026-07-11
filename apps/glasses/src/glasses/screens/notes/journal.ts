import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const journalScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-journal',
  parent: 'notes-menu',
  title: 'JOURNAL',
  emptyMessage: 'No journal entries.',
})
