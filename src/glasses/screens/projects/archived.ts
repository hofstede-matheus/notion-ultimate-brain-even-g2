import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const archivedScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'projects-archived',
  parent: 'projects-menu',
  title: 'ARCHIVED PROJECTS',
  emptyMessage: 'No archived projects.',
})
