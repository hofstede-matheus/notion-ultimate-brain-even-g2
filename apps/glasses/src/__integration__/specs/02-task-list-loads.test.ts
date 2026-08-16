import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/tasks/tasks-menu.feature, task-lists.feature.
 *
 * Proves the real navigation -> fetch -> render pipeline over real HTTP
 * (against the fixture server, not a mocked api.ts module — see the unit
 * suite's tasks/*.test.ts for that layer) and that the resulting list is
 * something the SDK actually accepted and painted.
 */
describe('task list loads over HTTP', () => {
  it('menu -> Tasks -> Today renders the fetched list', async () => {
    let cursor = await driver.latestId();
    await driver.tap(); // root menu idx0 "Tasks"
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // tasks-menu idx0 -> idx1 "Today"
    await driver.tap();

    await driver.waitForLine(/API\s+.*\/api\/tasks\/today 200/, {
      from: cursor,
      timeoutMs: 15_000,
    });
    await driver.waitForLine(/API\s+loaded today/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=list screen=today/, { from: cursor });

    expect(await driver.currentScreen()).toBe('today');
    assertLit(await driver.screenshotGlasses(), '02-glasses-today');
  });
});
