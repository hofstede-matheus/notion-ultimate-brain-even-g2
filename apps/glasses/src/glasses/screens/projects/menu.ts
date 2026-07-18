import type { ScreenName } from '../../../state'
import type { ScreenModule, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const projectsMenuDef: MenuDef = {
  title: 'PROJECTS',
  parent: 'menu',
  items: [
    { label: 'Active', target: 'projects-active' },
    { label: 'Planned', target: 'projects-planned' },
    { label: 'Board', target: 'projects-board' },
    { label: 'Archived', target: 'projects-archived' },
  ],
}

/** Route a projects-submenu target screen through the correct ctx entry point. */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target)
}

export const projectsMenuScreen: ScreenModule = makeMenuScreen(projectsMenuDef, open)
