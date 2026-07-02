import type { AppState } from '../../../state'
import type { Screen, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const tagsMenuDef: MenuDef = {
  title: 'TAGS',
  parent: 'menu',
  items: [{ label: 'Recent' }, { label: 'Favorites' }, { label: 'A-Z' }],
}

export const tagsMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(tagsMenuDef)
