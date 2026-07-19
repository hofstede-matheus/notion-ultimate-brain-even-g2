import type { MenuDef, ScreenModule } from '../types';
import { makeMenuScreen } from './shared';

export const ROOT_MENU_ITEMS = ['Tasks', 'Notes', 'Projects', 'Tags'];

const rootMenuDef: MenuDef = {
  title: 'Ultimate Brain for Even G2',
  items: [
    { label: 'Tasks', target: 'tasks-menu' },
    { label: 'Notes', target: 'notes-menu' },
    { label: 'Projects', target: 'projects-menu' },
    { label: 'Tags', target: 'tags-menu' },
  ],
};

export const menuScreen: ScreenModule = makeMenuScreen(rootMenuDef);
