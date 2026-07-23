import type { ScreenName } from '../../../../state';
import type { GlassCtx, MenuDef, ScreenModule } from '../../../types';
import { makeMenuScreen } from '../../_shared/screen-factories';

const tagTypesMenuDef: MenuDef = {
  title: 'TAG TYPES',
  parent: 'tags-menu',
  items: [
    { label: 'Area', target: 'tags-types-area' },
    { label: 'Resource', target: 'tags-types-resource' },
    { label: 'Entity', target: 'tags-types-entity' },
  ],
};

/** Every item here is a fetched list screen — route through enterView(). */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target);
}

export const tagTypesMenuScreen: ScreenModule = makeMenuScreen(tagTypesMenuDef, open);
