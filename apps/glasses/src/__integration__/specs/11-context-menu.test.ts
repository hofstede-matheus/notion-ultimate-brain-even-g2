import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/the-five-gestures.feature (hold, tap-and-hold),
 * tasks/a-task/action-menu.feature.
 *
 * The OS contextual menu is a whole new input mode (SDK 0.0.14+ / simulator
 * 0.9.1+) that replaced the app-drawn task-actions/note-actions screens —
 * specs 03/04/05/07/09 each exercise one menu item end to end, but none of
 * them look at the overlay itself. This is the one place that proves the
 * `menuObject` payload the app declares (see render/index.ts's
 * toMenuContainer) actually reaches the OS and paints — a mocked bridge
 * (every unit test) accepts any payload unconditionally and can't catch a
 * rejected or malformed menu.
 *
 * It is also the only place the two hold gestures are told apart against a
 * real event stream: both deliver LONG_PRESS_EVENT, and only the overlay's
 * FOREGROUND_ENTER distinguishes them (see HOLD_ACTION_DELAY_MS).
 */
describe('the OS contextual menu', () => {
  /** Tasks menu -> Today -> tap row 0, landing on "Buy groceries"'s details. */
  async function openTaskDetails() {
    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Buy groceries"
    await driver.waitForLine(/SEL\s+today row 0 "Buy groceries"/, { from: cursor });
    await driver.waitForLine(/NAV\s+today -> task-details/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=text screen=task-details/, { from: cursor });
  }

  it('tap-and-hold raises the overlay with the five task actions, and a selection reaches the app', async () => {
    await openTaskDetails();

    let cursor = await driver.latestId();
    await driver.holdToOpenContextMenu();
    // The hold shortcut must stand down once the overlay announces itself, or tap-and-hold
    // would leave a mark-done confirmation waiting behind the menu.
    await driver.waitForLine(/EVT\s+hold action cancelled/, { from: cursor });

    // The overlay is OS-drawn, not one of the app's own screens — there is
    // no RENDER/NAV line for it, only the framebuffer itself.
    assertLit(await driver.screenshotGlasses(), '11-glasses-context-menu');

    // "Open page" (idx0) — a different item than spec 03's Mark as done, and the one that
    // proves the reader is still reachable now that a tap no longer opens it.
    cursor = await driver.latestId();
    await driver.selectContextMenuItem(0);
    await driver.waitForLine(/EVT\s+menuItemClickEvent/, { from: cursor });
    await driver.waitForLine(/MENU\s+item \d+ selected/, { from: cursor });
    await driver.waitForLine(/NAV\s+openPage "Buy groceries"/, { from: cursor });

    expect(await driver.currentScreen()).toBe('page-content');

    // Back out of the reader lands on the details it was opened from, not the list.
    cursor = await driver.latestId();
    await driver.back();
    await driver.waitForLine(/NAV\s+page-content -> task-details/, { from: cursor });
  });

  it('a plain hold, with no menu following, marks the task done instead', async () => {
    await driver.resetToRootMenu();
    await openTaskDetails();

    const cursor = await driver.latestId();
    await driver.longPress();
    await driver.longPressRelease();

    // No context_menu follows, so nothing cancels the shortcut and it runs on its own.
    await driver.waitForLine(/EVT\s+hold settled/, { from: cursor });
    await driver.waitForLine(/MENU\s+hold -> mark as done/, { from: cursor });
    await driver.waitForLine(/ACT\s+confirm open kind=markDone/, { from: cursor });
    await driver.waitForLine(/NAV\s+task-details -> mark-done-confirm/, { from: cursor });

    expect(await driver.currentScreen()).toBe('mark-done-confirm');
  });
});
