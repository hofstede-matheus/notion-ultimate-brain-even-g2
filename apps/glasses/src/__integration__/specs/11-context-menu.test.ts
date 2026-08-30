import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/the-three-gestures.feature (long-press),
 * tasks/a-task/action-menu.feature.
 *
 * The OS contextual menu is a whole new input mode (SDK 0.0.14+ / simulator
 * 0.9.1+) that replaced the app-drawn task-actions/note-actions screens —
 * spec 03/05/07/09/10 each exercise one menu item end to end, but none of
 * them look at the overlay itself. This is the one place that proves the
 * `menuObject` payload the app declares (see render/index.ts's
 * toMenuContainer) actually reaches the OS and paints — a mocked bridge
 * (every unit test) accepts any payload unconditionally and can't catch a
 * rejected or malformed menu.
 */
describe('the OS contextual menu', () => {
  it('long-press raises the overlay with the five task actions, in order, and a selection reaches the app', async () => {
    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    // Tap row 0 ("Buy groceries") once to prime which row a following
    // long-press resolves to — the simulator's LONG_PRESS_EVENT carries no
    // row index of its own (state.lastHighlightedIndex's doc comment), and
    // a previous spec's own tap can otherwise leave 'today' pointed at a
    // different row for the rest of the shared simulator session.
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

    // The overlay is OS-drawn, not one of the app's own screens — there is
    // no RENDER/NAV line for it, only the framebuffer itself.
    assertLit(await driver.screenshotGlasses(), '11-glasses-context-menu');

    // Task Details (idx0) — a different item than spec 03's Mark as done, so
    // this spec's own final screenshot is unambiguously the details screen.
    cursor = await driver.latestId();
    await driver.selectContextMenuItem(0);
    await driver.waitForLine(/EVT\s+menuItemClickEvent/, { from: cursor });
    await driver.waitForLine(/MENU\s+item \d+ selected/, { from: cursor });
    await driver.waitForLine(/NAV\s+today -> task-details/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=text screen=task-details/, { from: cursor });

    expect(await driver.currentScreen()).toBe('task-details');
  });
});
