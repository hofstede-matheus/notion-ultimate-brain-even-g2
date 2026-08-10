import { APP_DISPLAY_NAME } from '../app-info';
import { makeMenuScreen } from './modules/_shared/screen-factories';
import type { MenuDef, ScreenModule } from './types';

export const ROOT_MENU_ITEMS = ['Tasks', 'Notes', 'Projects', 'Tags'];

const rootMenuDef: MenuDef = {
  title: APP_DISPLAY_NAME,
  items: [
    { label: 'Tasks', target: 'tasks-menu' },
    { label: 'Notes', target: 'notes-menu' },
    { label: 'Projects', target: 'projects-menu' },
    { label: 'Tags', target: 'tags-menu' },
  ],
};

export const menuScreen: ScreenModule = makeMenuScreen(rootMenuDef);
