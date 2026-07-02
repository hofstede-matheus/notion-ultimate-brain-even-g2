import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeStubScreen } from '../shared'

export const tagsAzScreen: Screen<AppState, GlassCtx> = makeStubScreen(
  'A-Z',
  'tags-menu',
)
