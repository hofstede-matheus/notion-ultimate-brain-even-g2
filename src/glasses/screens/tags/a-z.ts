import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const tagsAzScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tags-a-z',
  parent: 'tags-menu',
  title: 'TAGS A-Z',
  emptyMessage: 'No tags.',
})
