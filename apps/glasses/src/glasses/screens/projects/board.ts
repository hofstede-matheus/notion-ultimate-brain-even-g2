import type { ScreenModule } from '../../types'
import { makeListScreen } from '../shared'

export const boardScreen: ScreenModule = makeListScreen({
  screen: 'projects-board',
  parent: 'projects-menu',
  title: 'PROJECT BOARD',
  emptyMessage: 'No projects.',
})
