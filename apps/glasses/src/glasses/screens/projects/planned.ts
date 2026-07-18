import type { ScreenModule } from '../../types'
import { makeListScreen } from '../shared'

export const plannedScreen: ScreenModule = makeListScreen({
  screen: 'projects-planned',
  parent: 'projects-menu',
  title: 'PLANNED PROJECTS',
  emptyMessage: 'No planned projects.',
})
