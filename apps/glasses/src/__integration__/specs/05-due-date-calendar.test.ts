import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/tasks/a-task/change-due-date/calendar.feature.
 *
 * The one `mode: 'bitmap'` screen in the app — its containers are declared
 * only here (see render/index.ts's comment on the simulator's 4-container
 * cap) and sent as raw image tiles, nothing like the native list/text paths
 * every other screen uses. A mocked bridge returns `success` unconditionally
 * for `updateImageRawData`; this is the one check in the suite that the
 * calendar's bitmap payload is actually well-formed enough for the SDK
 * (real or simulated) to accept and paint it.
 */
describe('due-date calendar renders as a bitmap', () => {
  it('opens the calendar, sends tiles, and reaches day-select', async () => {
    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Today"
    await driver.tap();
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    // A tap opens the task's details, where its contextual menu is declared.
    cursor = await driver.latestId();
    await driver.swipeDown(); // idx0 -> idx1 "Renew passport"
    await driver.tap();
    await driver.waitForLine(/SEL\s+today row 1 "Renew passport"/, { from: cursor });
    await driver.waitForLine(/NAV\s+today -> task-details/, { from: cursor });

    cursor = await driver.latestId();
    await driver.holdToOpenContextMenu();

    cursor = await driver.latestId();
    // TASK_CONTEXT_MENU order: Open page, Change due date, Change project,
    // Mark as done, Delete task — see glasses/context-menu.ts.
    await driver.selectContextMenuItem(1);
    await driver.waitForLine(/MENU\s+item \d+ selected/, { from: cursor });
    await driver.waitForLine(/NAV\s+task-details -> task-due-date/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=bitmap screen=task-due-date/, { from: cursor });
    const tiles = await driver.waitForLine(/CAL\s+tiles sent/, { from: cursor });
    expect(tiles.message).toMatch(/tiles=\d+/);

    assertLit(await driver.screenshotGlasses(), '05-glasses-calendar-week');

    // Seeded on the task's own due date, so the found cell is always within
    // rows 1-6 of the grid — never the PREV/NEXT MONTH rows (0/7). See
    // month-grid.ts's findCell/buildMonthGrid: this holds for any due date.
    cursor = await driver.latestId();
    await driver.tap(); // week -> day
    await driver.waitForLine(/CAL\s+phase week -> day/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // day cell -> due-date-confirm
    await driver.waitForLine(/ACT\s+due date selected/, { from: cursor });
    await driver.waitForLine(/NAV\s+task-due-date -> due-date-confirm/, { from: cursor });

    expect(await driver.currentScreen()).toBe('due-date-confirm');
  });
});
