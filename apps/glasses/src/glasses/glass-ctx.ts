import type { GlassCtx } from './types';
import { enterNoteMetadata, openNoteActions } from './modules/notes/actions';
import { openProjectDetail } from './modules/projects/actions';
import { ITEM_ACTIONS, confirmAction, dismissActionToast, dismissConfirm, openConfirm } from './modules/_shared/item-actions';
import { enterView, navigate, shutdown, stopSpinner } from './modules/_shared/navigation';
import { openPage, turnPage } from './modules/_shared/page-reader';
import { enterTaskMetadata, openTaskActions } from './modules/tasks/actions';
import {
  cancelRecordingAndGoBack,
  confirmAddTask,
  discardAddTask,
  startRecording,
} from './modules/tasks/voice';

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
