import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const inboxScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'inbox',
  parent: 'tasks-menu',
  title: 'INBOX',
  emptyMessage: 'Your inbox is empty!',
  loadingMessage: 'Fetching tasks...',
  onSelect: 'task',
})
