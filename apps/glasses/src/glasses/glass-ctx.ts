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
import { enterNoteMetadata, openNoteActions } from './modules/notes/actions';
import { openProjectDetail } from './modules/projects/actions';
import { enterTaskMetadata, openTaskActions } from './modules/tasks/actions';
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
    openConfirm: (kind, itemId, itemName, returnTo) => {
      const action = ITEM_ACTIONS[kind];
      openConfirm(action, itemId, itemName, returnTo);
    },
    confirmAction,
    dismissConfirm,
    dismissActionToast,
    openTaskActions,
    enterTaskMetadata: () => void enterTaskMetadata(),
    openNoteActions,
    enterNoteMetadata: () => void enterNoteMetadata(),
    openPage: (pageId, title, returnTo) => void openPage(pageId, title, returnTo),
    turnPage,
    openProjectDetail,
  };
}
