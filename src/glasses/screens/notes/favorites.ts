import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const notesFavoritesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-favorites',
  parent: 'notes-menu',
  title: 'FAVORITE NOTES',
  emptyMessage: 'No favorite notes.',
})
