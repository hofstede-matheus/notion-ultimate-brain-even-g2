import type { ScreenName } from '../../../../state';
import type { GlassCtx, MenuDef, ScreenModule } from '../../../types';
import { makeMenuScreen } from '../../_shared/screen-factories';

const projectsMenuDef: MenuDef = {
  title: 'PROJECTS',
  parent: 'menu',
  items: [
    { label: 'Doing', target: 'projects-doing' },
    { label: 'Ongoing', target: 'projects-ongoing' },
    { label: 'Planned', target: 'projects-planned' },
    { label: 'On Hold', target: 'projects-on-hold' },
    { label: 'Done', target: 'projects-done' },
    { label: 'Archived', target: 'projects-archived' },
  ],
};

/** All items are fetched list screens — route through enterView(). */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target);
}

export const projectsMenuScreen: ScreenModule = makeMenuScreen(projectsMenuDef, open);
