import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const tagsFavoritesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tags-favorites',
  parent: 'tags-menu',
  title: 'FAVORITE TAGS',
  emptyMessage: 'No favorite tags.',
})
