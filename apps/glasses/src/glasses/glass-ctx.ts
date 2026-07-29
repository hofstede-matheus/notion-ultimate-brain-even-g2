import {
  confirmAction,
  dismissActionToast,
  dismissConfirm,
  ITEM_ACTIONS,
  openConfirm,
} from './modules/_shared/item-actions';
import {
  enterView,
  navigate,
  shutdown,
  stopSpinner,
  turnListPage,
} from './modules/_shared/navigation';
import { openPage, turnPage } from './modules/_shared/page-reader';
import { openProjectPicker, pickProject } from './modules/_shared/project-picker';
import { enterNoteMetadata, openNoteActions } from './modules/notes/actions';
import { openProjectDetail } from './modules/projects/actions';
import { openTagNotes } from './modules/tags/actions';
import { enterTaskMetadata, openTaskActions } from './modules/tasks/actions';
import {
  dueDatePickerBack,
  moveDueDateCursor,
  openDueDatePicker,
  selectDueDateCell,
} from './modules/tasks/calendar/picker';
import {
  cancelRecordingAndGoBack,
  confirmAddTask,
  discardAddTask,
  startRecording,
} from './modules/tasks/voice';
import type { GlassCtx } from './types';

// ---------------------------------------------------------------------------
// Public context — side-effect surface handed to screen action() handlers.
// Composition root only: each entry point is implemented in its own domain
// module (tasks/, notes/, projects/, shared/) and wired together here into
// the single GlassCtx object screens receive.
// ---------------------------------------------------------------------------

export function createGlassCtx(): GlassCtx {
  return {
    navigate,
    shutdown,
    stopSpinner,
    enterView: (screen) => void enterView(screen),
    turnListPage,
    startRecording: () => void startRecording(),
    cancelRecordingAndGoBack,
    confirmAddTask,
    discardAddTask,
    openConfirm: (kind, itemId, itemName, returnTo, extra) => {
      const action = ITEM_ACTIONS[kind];
      openConfirm(action, itemId, itemName, returnTo, extra);
    },
    confirmAction,
    dismissConfirm,
    dismissActionToast,
    openTaskActions,
    enterTaskMetadata: () => void enterTaskMetadata(),
    openDueDatePicker,
    moveDueDateCursor,
    selectDueDateCell,
    dueDatePickerBack,
    openNoteActions,
    enterNoteMetadata: () => void enterNoteMetadata(),
    openPage: (pageId, title, returnTo) => void openPage(pageId, title, returnTo),
    turnPage,
    openProjectDetail,
    openProjectPicker,
    pickProject,
    openTagNotes,
  };
}
