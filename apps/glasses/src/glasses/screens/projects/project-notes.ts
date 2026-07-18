import type { AppState } from '../../../state'
import type { ScreenModule } from '../../types'
import { makeListScreen } from '../shared'

export const projectNotesScreen: ScreenModule = makeListScreen({
  screen: 'project-notes',
  parent: 'project-detail',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — NOTES`,
  emptyMessage: 'No notes in this project.',
})
