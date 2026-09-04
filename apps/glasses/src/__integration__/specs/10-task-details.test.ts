import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/tasks/a-task/task-details.feature — the screen a tap
 * on a task row opens, and the anchor for its contextual menu (spec 11).
 *
 * A details screen is `mode: 'text'` whose body is assembled from a fetch
 * that happens *after* navigation — the screen paints "Loading…" first, then
 * repaints with the fetched fields. Unit tests cover the field formatting
 * (details-screen + formatDueDate); what only the simulator can confirm is
 * that the second paint actually lands, and that the fully-expanded text
 * (values are printed in full, never truncated) still fits its container
 * without re-arming the firmware scroll.
 */
describe('task details', () => {
  it('tapping a task row fetches its details and repaints with the fetched fields', async () => {
    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    // A tap is now the whole route in — no menu step, and no page-reader fetch on the way.
    cursor = await driver.latestId();
    await driver.tap();
    await driver.waitForLine(/SEL\s+today row 0 "Buy groceries"/, { from: cursor });
    await driver.waitForLine(/NAV\s+today -> task-details/, { from: cursor });
    await driver.waitForLine(/API\s+.*\/api\/pages\/task-mark-done\/details 200/, { from: cursor });

    // The repaint after the fetch resolves — the whole point of this screen.
    const loaded = await driver.waitForLine(/API\s+task details loaded/, { from: cursor });
    expect(loaded.message).toMatch(/project="?Alpha Rollout"?/);
    await driver.waitForLine(/RENDER full mode=text screen=task-details/, { from: cursor });

    expect(await driver.currentScreen()).toBe('task-details');
    assertLit(await driver.screenshotGlasses(), '10-glasses-task-details');
  });
});
