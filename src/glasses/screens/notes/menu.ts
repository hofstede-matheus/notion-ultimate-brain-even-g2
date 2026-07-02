import type { AppState } from '../../../state'
import type { Screen, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const notesMenuDef: MenuDef = {
  title: 'NOTES',
  parent: 'menu',
  items: [
    { label: 'Notes' },
    { label: 'Inbox' },
    { label: 'Favorites' },
    { label: 'Meetings' },
    { label: 'All' },
  ],
}

export const notesMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(notesMenuDef)
