import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const recentTagsScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'tags-recent',
  parent: 'tags-menu',
  title: 'RECENT TAGS',
  emptyMessage: 'No recent tags.',
})
