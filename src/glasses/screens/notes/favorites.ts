import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const notesFavoritesScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Favorites',
  'notes-menu',
)
