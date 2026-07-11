import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const activeScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'projects-active',
  parent: 'projects-menu',
  title: 'ACTIVE PROJECTS',
  emptyMessage: 'No active projects.',
})
