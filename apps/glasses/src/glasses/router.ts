import type { AppState } from '../state';
import { FALLBACK_SCREEN } from './constants';
import { menuScreen } from './screens/menu';
import { allNotesScreen } from './screens/notes/all';
import { notesByProjectScreen } from './screens/notes/by-project';
import { notesByTagScreen } from './screens/notes/by-tag';
import { clipsScreen } from './screens/notes/clips';
import { notesFavoritesScreen } from './screens/notes/favorites';
import { notesInboxScreen } from './screens/notes/inbox';
import { journalScreen } from './screens/notes/journal';
import { meetingsScreen } from './screens/notes/meetings';
import { notesMenuScreen } from './screens/notes/menu';
import { notesListScreen } from './screens/notes/notes';
import { voiceNotesScreen } from './screens/notes/voice';
import { activeScreen as projectsActiveScreen } from './screens/projects/active';
import { archivedScreen } from './screens/projects/archived';
import { boardScreen } from './screens/projects/board';
import { projectDetailScreen } from './screens/projects/detail';
import { projectsMenuScreen } from './screens/projects/menu';
import { plannedScreen } from './screens/projects/planned';
import { projectNotesScreen } from './screens/projects/project-notes';
import { projectTasksScreen } from './screens/projects/project-tasks';
import { tagsAzScreen } from './screens/tags/a-z';
import { tagsFavoritesScreen } from './screens/tags/favorites';
import { tagsMenuScreen } from './screens/tags/menu';
import { recentTagsScreen } from './screens/tags/recent';
import { tagsTypesScreen } from './screens/tags/types';
import { addTaskScreen } from './screens/tasks/add-task';
import { deleteConfirmScreen } from './screens/tasks/delete-confirm';
import { deleteToastScreen } from './screens/tasks/delete-toast';
import { inboxScreen } from './screens/tasks/inbox';
import { markDoneConfirmScreen } from './screens/tasks/mark-done-confirm';
import { markDoneToastScreen } from './screens/tasks/mark-done-toast';
import { tasksMenuScreen } from './screens/tasks/menu';
import { next7DaysScreen } from './screens/tasks/next-7-days';
import { overdueScreen } from './screens/tasks/overdue';
import { taskActionsScreen } from './screens/tasks/task-actions';
import { taskMetadataScreen } from './screens/tasks/task-metadata';
import { todayScreen } from './screens/tasks/today';
import { tomorrowScreen } from './screens/tasks/tomorrow';
import type { AppGlassAction, GlassCtx, ScreenDisplay, ScreenModule } from './types';

const SCREENS: Record<string, ScreenModule> = {
  menu: menuScreen,
  'tasks-menu': tasksMenuScreen,
  'notes-menu': notesMenuScreen,
  'projects-menu': projectsMenuScreen,
  'tags-menu': tagsMenuScreen,
  overdue: overdueScreen,
  today: todayScreen,
  inbox: inboxScreen,
  'add-task': addTaskScreen,
  'tasks-next-7-days': next7DaysScreen,
  'tasks-tomorrow': tomorrowScreen,
  'notes-inbox': notesInboxScreen,
  'notes-favorites': notesFavoritesScreen,
  'notes-by-tag': notesByTagScreen,
  'notes-list': notesListScreen,
  'notes-meetings': meetingsScreen,
  'notes-by-project': notesByProjectScreen,
  'notes-clips': clipsScreen,
  'notes-voice': voiceNotesScreen,
  'notes-journal': journalScreen,
  'notes-all': allNotesScreen,
  'projects-active': projectsActiveScreen,
  'projects-planned': plannedScreen,
  'projects-board': boardScreen,
  'projects-archived': archivedScreen,
  'tags-recent': recentTagsScreen,
  'tags-favorites': tagsFavoritesScreen,
  'tags-a-z': tagsAzScreen,
  'tags-types': tagsTypesScreen,
  'mark-done-confirm': markDoneConfirmScreen,
  'mark-done-toast': markDoneToastScreen,
  'task-actions': taskActionsScreen,
  'task-metadata': taskMetadataScreen,
  'delete-confirm': deleteConfirmScreen,
  'delete-toast': deleteToastScreen,
  'project-detail': projectDetailScreen,
  'project-tasks': projectTasksScreen,
  'project-notes': projectNotesScreen,
};

// Resolved once so getScreen has a guaranteed-defined fallback without a
// non-null assertion; menuScreen backstops it if FALLBACK_SCREEN ever changes
// to a key not registered in SCREENS.
const fallbackScreen: ScreenModule = SCREENS[FALLBACK_SCREEN] ?? menuScreen;

function getScreen(name: string): ScreenModule {
  return SCREENS[name] ?? fallbackScreen;
}

export const router = {
  toDisplayData(snapshot: AppState): ScreenDisplay {
    return getScreen(snapshot.screen).display(snapshot);
  },
  onGlassAction(action: AppGlassAction, snapshot: AppState, ctx: GlassCtx): void {
    getScreen(snapshot.screen).action(action, snapshot, ctx);
  },
};
