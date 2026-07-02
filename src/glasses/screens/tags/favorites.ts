import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const tagsFavoritesScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Favorites',
  'tags-menu',
)
