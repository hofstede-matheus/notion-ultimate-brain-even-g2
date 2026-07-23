import type { AppState } from '../state';
import { FALLBACK_SCREEN } from './constants';
import { menuScreen } from './menu';
import { deleteConfirmScreen } from './modules/_shared/delete-confirm';
import { deleteToastScreen } from './modules/_shared/delete-toast';
import { pageContentScreen } from './modules/_shared/page-content-screen';
import { allNotesScreen } from './modules/notes/screens/all';
import { notesByProjectScreen } from './modules/notes/screens/by-project';
import { notesByTagScreen } from './modules/notes/screens/by-tag';
import { clipsScreen } from './modules/notes/screens/clips';
import { notesFavoritesScreen } from './modules/notes/screens/favorites';
import { notesInboxScreen } from './modules/notes/screens/inbox';
import { journalScreen } from './modules/notes/screens/journal';
import { meetingsScreen } from './modules/notes/screens/meetings';
import { notesMenuScreen } from './modules/notes/screens/menu';
import { noteActionsScreen } from './modules/notes/screens/note-actions';
import { noteMetadataScreen } from './modules/notes/screens/note-metadata';
import { notesListScreen } from './modules/notes/screens/notes';
import { voiceNotesScreen } from './modules/notes/screens/voice';
import { archivedScreen } from './modules/projects/screens/archived';
import { boardScreen } from './modules/projects/screens/board';
import { projectDetailScreen } from './modules/projects/screens/detail';
import { doingScreen } from './modules/projects/screens/doing';
import { doneScreen } from './modules/projects/screens/done';
import { projectsMenuScreen } from './modules/projects/screens/menu';
import { onHoldScreen } from './modules/projects/screens/on-hold';
import { ongoingScreen } from './modules/projects/screens/ongoing';
import { plannedScreen } from './modules/projects/screens/planned';
import { projectNotesScreen } from './modules/projects/screens/project-notes';
import { projectTasksDoneScreen } from './modules/projects/screens/project-tasks-done';
import { projectTasksMenuScreen } from './modules/projects/screens/project-tasks-menu';
import { projectTasksTodoScreen } from './modules/projects/screens/project-tasks-todo';
import { tagsAzScreen } from './modules/tags/screens/a-z';
import { tagsFavoritesScreen } from './modules/tags/screens/favorites';
import { tagsMenuScreen } from './modules/tags/screens/menu';
import { tagNotesScreen } from './modules/tags/screens/notes';
import { recentTagsScreen } from './modules/tags/screens/recent';
import { tagTypesMenuScreen } from './modules/tags/screens/type-menu';
import { tagsTypesAreaScreen } from './modules/tags/screens/types-area';
import { tagsTypesEntityScreen } from './modules/tags/screens/types-entity';
import { tagsTypesResourceScreen } from './modules/tags/screens/types-resource';
import { addTaskScreen } from './modules/tasks/screens/add-task';
import { inboxScreen } from './modules/tasks/screens/inbox';
import { markDoneConfirmScreen } from './modules/tasks/screens/mark-done-confirm';
import { markDoneToastScreen } from './modules/tasks/screens/mark-done-toast';
import { tasksMenuScreen } from './modules/tasks/screens/menu';
import { next7DaysScreen } from './modules/tasks/screens/next-7-days';
import { overdueScreen } from './modules/tasks/screens/overdue';
import { taskActionsScreen } from './modules/tasks/screens/task-actions';
import { taskMetadataScreen } from './modules/tasks/screens/task-metadata';
import { todayScreen } from './modules/tasks/screens/today';
import { tomorrowScreen } from './modules/tasks/screens/tomorrow';
import type { AppGlassAction, GlassCtx, ScreenDisplay, ScreenModule } from './types';

/**
 * Every screen in the app. Exported so tests can enumerate them — that's what
 * lets a newly added screen be caught by a coverage check instead of silently
 * missing whatever registration it also needed.
 */
export const SCREENS: Record<string, ScreenModule> = {
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
  'projects-doing': doingScreen,
  'projects-ongoing': ongoingScreen,
  'projects-planned': plannedScreen,
  'projects-on-hold': onHoldScreen,
  'projects-done': doneScreen,
  'projects-board': boardScreen,
  'projects-archived': archivedScreen,
  'tags-recent': recentTagsScreen,
  'tags-favorites': tagsFavoritesScreen,
  'tags-a-z': tagsAzScreen,
  'tag-types-menu': tagTypesMenuScreen,
  'tags-types-area': tagsTypesAreaScreen,
  'tags-types-resource': tagsTypesResourceScreen,
  'tags-types-entity': tagsTypesEntityScreen,
  'tag-notes': tagNotesScreen,
  'mark-done-confirm': markDoneConfirmScreen,
  'mark-done-toast': markDoneToastScreen,
  'task-actions': taskActionsScreen,
  'task-metadata': taskMetadataScreen,
  'note-actions': noteActionsScreen,
  'note-metadata': noteMetadataScreen,
  'page-content': pageContentScreen,
  'delete-confirm': deleteConfirmScreen,
  'delete-toast': deleteToastScreen,
  'project-detail': projectDetailScreen,
  'project-tasks-menu': projectTasksMenuScreen,
  'project-tasks-todo': projectTasksTodoScreen,
  'project-tasks-done': projectTasksDoneScreen,
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
