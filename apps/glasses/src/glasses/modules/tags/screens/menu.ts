import type { ScreenName } from '../../../../state';
import type { GlassCtx, MenuDef, ScreenModule } from '../../../types';
import { makeMenuScreen } from '../../_shared/screen-factories';

const tagsMenuDef: MenuDef = {
  title: 'TAGS',
  parent: 'menu',
  items: [
    { label: 'Recent', target: 'tags-recent' },
    { label: 'Fav.', target: 'tags-favorites' },
    { label: 'A-Z', target: 'tags-a-z' },
    { label: 'Types', target: 'tag-types-menu' },
  ],
};

/**
 * Route a tags-submenu target screen through the correct ctx entry point —
 * Types is a static submenu (Area/Resource/Entity), the rest are fetched
 * list views.
 */
function open(target: ScreenName, ctx: GlassCtx): void {
  if (target === 'tag-types-menu') ctx.navigate(target);
  else ctx.enterView(target);
}

export const tagsMenuScreen: ScreenModule = makeMenuScreen(tagsMenuDef, open);
