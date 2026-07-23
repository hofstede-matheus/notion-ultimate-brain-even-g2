import type { AppState, ScreenName } from '../../../../state';
import type { GlassCtx, MenuDef, ScreenModule } from '../../../types';
import { makeMenuScreen } from '../../_shared/screen-factories';

function buildDef(state: AppState): MenuDef {
  return {
    title: `${state.selectedProject?.name ?? 'PROJECT'} — TASKS`,
    parent: 'project-detail',
    items: [
      { label: 'To Do', target: 'project-tasks-todo' },
      { label: 'Done', target: 'project-tasks-done' },
    ],
  };
}

/** Both items are fetched list screens — route through enterView(). */
function open(target: ScreenName, ctx: GlassCtx): void {
  ctx.enterView(target);
}

/**
 * makeMenuScreen's def is static, but this menu's title depends on the
 * selected project's name — so build a fresh ScreenModule per call instead
 * of a single module-level makeMenuScreen(def).
 */
export const projectTasksMenuScreen: ScreenModule = {
  display(state) {
    return makeMenuScreen(buildDef(state), open).display(state);
  },
  action(action, state, ctx) {
    return makeMenuScreen(buildDef(state), open).action(action, state, ctx);
  },
};
