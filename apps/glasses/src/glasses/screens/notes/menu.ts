import type { ScreenName } from '../../../state'
import type { ScreenModule, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const notesMenuDef: MenuDef = {
  title: 'NOTES',
  parent: 'menu',
  items: [
    { label: 'Inbox', target: 'notes-inbox' },
    { label: 'Fav.', target: 'notes-favorites' },
    { label: 'By Tag', target: 'notes-by-tag' },
    { label: 'Notes', target: 'notes-list' },
    { label: 'Meetings', target: 'notes-meetings' },
    { label: 'By Project', target: 'notes-by-project' },
    { label: 'Clips', target: 'notes-clips' },
    { label: 'Voice', target: 'notes-voice' },
    { label: 'Journal', target: 'notes-journal' },
    { label: 'All', target: 'notes-all' },
  ],
}

/** Route a notes-submenu target screen through the correct ctx entry point. */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target)
}

export const notesMenuScreen: ScreenModule = makeMenuScreen(notesMenuDef, open)
