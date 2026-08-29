import { describe, expect, it } from 'vitest';
import { FIXTURE_URL } from '../env';
import { driver } from './_setup';

/**
 * docs/features/glasses/confirming-a-change.feature,
 * a-task/mark-as-done/confirm.feature.
 *
 * The canonical mutation round trip: long-press -> OS contextual menu ->
 * confirm -> API call -> toast -> auto-return. Exercises the full chain over
 * real HTTP and asserts the fixture server actually received the PATCH — the
 * unit suite already covers the exact screen text at every step
 * (tasks/mark-done.test.ts), so this only checks that the pipeline moves the
 * real request end to end.
 */
describe('mark-done round trip', () => {
  it('long-press -> Mark as done -> PATCH /api/tasks/:id/done -> toast -> back to Today', async () => {
    await fetch(`${FIXTURE_URL}/__reset`, { method: 'POST' });

    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    // Tap row 0 ("Buy groceries"/task-mark-done) once to prime which row a
    // following long-press resolves to — the simulator's LONG_PRESS_EVENT
    // carries no row index of its own (state.lastHighlightedIndex's doc
    // comment), and a previous spec's own tap can otherwise leave 'today'
    // pointed at a different row for the rest of the shared simulator
    // session.
    cursor = await driver.latestId();
    await driver.tap();
    await driver.waitForLine(/SEL\s+today row 0 "Buy groceries"/, { from: cursor });
    await driver.waitForLine(/NAV\s+openPage "Buy groceries"/, { from: cursor });

    cursor = await driver.latestId();
    await driver.back(); // page-content -> today, row 0 still remembered
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    cursor = await driver.latestId();
    await driver.holdToOpenContextMenu();
    await driver.waitForLine(/SEL\s+today long-press row "Buy groceries"/, { from: cursor });

    cursor = await driver.latestId();
    // TASK_CONTEXT_MENU order: Task Details, Change due date, Change project,
    // Mark as done, Delete task — see glasses/context-menu.ts.
    await driver.selectContextMenuItem(3);
    await driver.waitForLine(/MENU\s+item \d+ selected/, { from: cursor });
    await driver.waitForLine(/NAV\s+today -> mark-done-confirm/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // idx0 "Confirm: Buy groceries"
    await driver.waitForLine(/ACT\s+calling markDone api/, { from: cursor });
    await driver.waitForLine(/ACT\s+ok, applied to today/, { from: cursor });
    await driver.waitForLine(/NAV\s+mark-done-confirm -> mark-done-toast/, { from: cursor });

    const callsRes = await fetch(`${FIXTURE_URL}/__calls`);
    const { calls } = (await callsRes.json()) as { calls: { method: string; path: string }[] };
    expect(calls).toContainEqual({
      method: 'PATCH',
      path: '/api/tasks/task-mark-done/done',
      body: undefined,
    });

    // The 1.5s toast auto-dismisses back to the list via a bare enterView()
    // call — item-actions.ts's setTimeout callback, unlike dismissActionToast()
    // (the manual GO_BACK path), logs no "toast dismissed" line of its own.
    await driver.waitForLine(/NAV\s+enterView\('today'\)/, { from: cursor, timeoutMs: 4000 });
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });
    expect(await driver.currentScreen()).toBe('today');
  });
});
