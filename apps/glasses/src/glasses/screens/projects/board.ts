import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const boardScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'projects-board',
  parent: 'projects-menu',
  title: 'PROJECT BOARD',
  emptyMessage: 'No projects.',
})
