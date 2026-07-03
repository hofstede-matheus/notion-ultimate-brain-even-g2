import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const notesByProjectScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'notes-by-project',
  parent: 'notes-menu',
  title: 'NOTES BY PROJECT',
  emptyMessage: 'No notes linked to a project.',
})
