import type { GlassCtx } from '../types';
import { ITEM_ACTIONS, confirmAction, dismissActionToast, dismissConfirm, openConfirm } from './item-actions';
import { enterView, navigate, shutdown, stopSpinner } from './navigation';
import { enterNoteMetadata, openNoteActions } from './note';
import { openPage, turnPage } from './page-reader';
import { openProjectDetail } from './project';
import { enterTaskMetadata, openTaskActions } from './task';
import {
  cancelRecordingAndGoBack,
  confirmAddTask,
  discardAddTask,
  startRecording,
} from './voice';

// ---------------------------------------------------------------------------
// Public context — side-effect surface handed to screen action() handlers.
// Composition root only: each entry point is implemented in its own
// domain module (navigation, item-actions, task, note, page-reader,
// project, voice) and wired together here into the single GlassCtx object
// screens receive.
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
