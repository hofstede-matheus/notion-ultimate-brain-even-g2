import type { ScreenModule } from '../../types'
import { makeListScreen } from '../shared'

export const clipsScreen: ScreenModule = makeListScreen({
  screen: 'notes-clips',
  parent: 'notes-menu',
  title: 'CLIPS',
  emptyMessage: 'No clips.',
})
