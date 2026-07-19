import type { ScreenName } from '../../../state';
import type { GlassCtx, MenuDef, ScreenModule } from '../../types';
import { makeMenuScreen } from '../shared';

const tagsMenuDef: MenuDef = {
  title: 'TAGS',
  parent: 'menu',
  items: [
    { label: 'Recent', target: 'tags-recent' },
    { label: 'Fav.', target: 'tags-favorites' },
    { label: 'A-Z', target: 'tags-a-z' },
    { label: 'Types', target: 'tags-types' },
  ],
};

/** Route a tags-submenu target screen through the correct ctx entry point. */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target);
}

export const tagsMenuScreen: ScreenModule = makeMenuScreen(tagsMenuDef, open);
