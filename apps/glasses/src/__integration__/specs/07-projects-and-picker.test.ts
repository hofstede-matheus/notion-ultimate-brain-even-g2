import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { FIXTURE_URL } from '../env';
import { driver } from './_setup';

/**
 * docs/features/glasses/projects/projects-menu.feature,
 * a-project/contents-menu.feature, a-project/tasks/task-lists.feature,
 * tasks/a-task/change-project/{picker,confirm}.feature.
 *
 * BOTH project flows live in this one file, in this order, on purpose.
 * `state.projectPicker` is set by openProjectPicker and **never cleared in
 * production** (only the unit harness clears it — see the README's "Known
 * cross-spec hazard"). Every project list screen branches on it:
 *
 *   onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project')
 *
 * so once the picker test below has run, tapping a project no longer opens
 * it — for the rest of the simulator session. Test order within a file is
 * guaranteed by vitest; test order *across* files is not (vitest sorts files
 * largest-first, not by name), so splitting these into two files would make
 * the drill-down test fail whenever it happened to be scheduled second.
 * Keep them here, in this order, until the leak itself is fixed.
 */
describe('projects', () => {
  it('drills down: Projects -> Doing -> a project -> Tasks -> To Do', async () => {
    let cursor = await driver.latestId();
    await driver.swipeDown();
    await driver.swipeDown(); // root menu idx0 -> idx2 "Projects"
    await driver.tap();
    await driver.waitForLine(/NAV\s+menu -> projects-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // projects-menu idx0 -> idx1 "Doing"
    await driver.tap();
    await driver.waitForLine(/API\s+.*\/api\/projects\/doing 200/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=list screen=projects-doing/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Alpha Rollout"
    await driver.waitForLine(/SEL\s+projects-doing row 0 "Alpha Rollout"/, { from: cursor });
    await driver.waitForLine(/NAV\s+openProjectDetail "Alpha Rollout"/, { from: cursor });
    await driver.waitForLine(/NAV\s+projects-doing -> project-detail/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // project-detail idx0 "Tasks"
    await driver.waitForLine(/NAV\s+project-detail -> project-tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // project-tasks-menu idx0 "To Do"
    await driver.waitForLine(/API\s+.*\/api\/tasks\/for-project\/project-alpha\/todo 200/, {
      from: cursor,
    });
    const render = await driver.waitForLine(
      /RENDER full mode=list screen=project-tasks-todo\s+items=(\d+)/,
      { from: cursor },
    );
    expect(Number(/items=(\d+)/.exec(render.message)?.[1])).toBe(2);

    expect(await driver.currentScreen()).toBe('project-tasks-todo');
    assertLit(await driver.screenshotGlasses(), '07-glasses-project-tasks');
  });

  // Leaks state.projectPicker for the rest of the session — must stay last.
  it('changes a task project: picker -> Doing -> project -> confirm -> toast', async () => {
    await fetch(`${FIXTURE_URL}/__reset`, { method: 'POST' });

    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Buy groceries"
    await driver.waitForLine(/NAV\s+today -> task-actions/, { from: cursor });

    cursor = await driver.latestId();
    for (let i = 0; i < 3; i++) await driver.swipeDown(); // idx0 -> idx3 "Change project"
    await driver.tap();
    await driver.waitForLine(/NAV\s+openProjectPicker "Buy groceries"/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=list screen=project-picker/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown();
    await driver.swipeDown(); // picker idx0 "— No project —" -> idx2 "Doing"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=projects-doing/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Alpha Rollout" — now a pick, not a drill-down
    await driver.waitForLine(/ACT\s+project picked "Alpha Rollout"/, { from: cursor });
    await driver.waitForLine(/NAV\s+projects-doing -> set-project-confirm/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // idx0 "To Alpha Rollout"
    await driver.waitForLine(/ACT\s+calling setProject api/, { from: cursor });
    await driver.waitForLine(/NAV\s+set-project-confirm -> set-project-toast/, { from: cursor });

    const { calls } = (await (await fetch(`${FIXTURE_URL}/__calls`)).json()) as {
      calls: { method: string; path: string; body?: unknown }[];
    };
    expect(calls).toContainEqual({
      method: 'PATCH',
      path: '/api/pages/task-mark-done/project',
      body: { projectId: 'project-alpha' },
    });

    // Toast auto-returns to the list the task was acted on from.
    // enterView logs NAV before the list paints; currentScreen() reads the
    // last RENDER line, so wait for that too (same as spec 03).
    await driver.waitForLine(/NAV\s+enterView\('today'\)/, { from: cursor, timeoutMs: 4000 });
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });
    expect(await driver.currentScreen()).toBe('today');
  });
});
