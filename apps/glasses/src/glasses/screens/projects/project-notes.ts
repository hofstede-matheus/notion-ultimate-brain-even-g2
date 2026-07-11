import type { AppState } from '../../../state'
import type { Screen, GlassCtx } from '../../types'
import { makeListScreen } from '../shared'

export const projectNotesScreen: Screen<AppState, GlassCtx> = makeListScreen({
  screen: 'project-notes',
  parent: 'project-detail',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — NOTES`,
  emptyMessage: 'No notes in this project.',
})
