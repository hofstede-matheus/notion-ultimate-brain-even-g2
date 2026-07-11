import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const notesByTagScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-by-tag',
  parent: 'notes-menu',
  title: 'NOTES BY TAG',
  emptyMessage: 'No tagged notes.',
})
