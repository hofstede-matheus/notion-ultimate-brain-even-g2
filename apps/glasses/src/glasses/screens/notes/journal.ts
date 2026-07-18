import type { ScreenModule } from '../../types'
import { makeListScreen } from '../shared'

export const journalScreen: ScreenModule = makeListScreen({
  screen: 'notes-journal',
  parent: 'notes-menu',
  title: 'JOURNAL',
  emptyMessage: 'No journal entries.',
})
