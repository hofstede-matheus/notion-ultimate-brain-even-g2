import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const recentTagsScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'Recent',
  'tags-menu',
)
