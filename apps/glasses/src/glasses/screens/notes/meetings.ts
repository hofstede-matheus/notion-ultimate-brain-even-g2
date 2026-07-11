import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const meetingsScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-meetings',
  parent: 'notes-menu',
  title: 'MEETINGS',
  emptyMessage: 'No meeting notes.',
})
