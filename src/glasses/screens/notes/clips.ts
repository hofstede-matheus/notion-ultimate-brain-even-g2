import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const clipsScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-clips',
  parent: 'notes-menu',
  title: 'CLIPS',
  emptyMessage: 'No clips.',
})
