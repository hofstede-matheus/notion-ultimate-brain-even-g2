import type { AppState } from '../../../state'
import type { Screen, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const projectsMenuDef: MenuDef = {
  title: 'PROJECTS',
  parent: 'menu',
  items: [{ label: 'Active' }, { label: 'Planned' }, { label: 'Board' }],
}

export const projectsMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(projectsMenuDef)
