import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const tagsTypesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tags-types',
  parent: 'tags-menu',
  title: 'TAG TYPES',
  emptyMessage: 'No tag types.',
})
