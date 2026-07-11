import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const plannedScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'projects-planned',
  parent: 'projects-menu',
  title: 'PLANNED PROJECTS',
  emptyMessage: 'No planned projects.',
})
