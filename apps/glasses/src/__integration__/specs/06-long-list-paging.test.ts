import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/paging-a-long-list.feature, how-a-list-looks.feature.
 *
 * The 25-item fixture forces MAX_LIST_ITEMS (20) paging and includes a
 * >63-UTF-8-byte multibyte title (MAX_ITEM_BYTES) — both caps the SDK
 * enforces on the native list widget for real. The app already truncates
 * before sending (screen-factories.ts's truncateListLabel), so under normal
 * conditions this never trips the simulator's own limit; see the plan's
 * verification step 4 for how to prove that failing this cap is actually
 * caught (temporarily widen MAX_ITEM_BYTES and confirm this spec goes red
 * while the unit suite stays green).
 */
describe('a long list pages correctly', () => {
  it('caps at one page, More/Prev turn the page both ways', async () => {
    let cursor = await driver.latestId();
    await driver.tap(); // menu -> tasks-menu
    await driver.waitForLine(/NAV\s+menu -> tasks-menu/, { from: cursor });

    cursor = await driver.latestId();
    for (let i = 0; i < 4; i++) await driver.swipeDown(); // idx0 -> idx4 "Next 7 Days"
    await driver.tap();
    const page1 = await driver.waitForLine(
      /RENDER full mode=list screen=tasks-next-7-days\s+items=(\d+)/,
      { from: cursor },
    );
    // 18 real items (PAGED_PAGE_SIZE = MAX_LIST_ITEMS - 2) + one "▸ More" row.
    expect(Number(/items=(\d+)/.exec(page1.message)?.[1])).toBe(19);
    assertLit(await driver.screenshotGlasses(), '06-glasses-list-page1');

    cursor = await driver.latestId();
    for (let i = 0; i < 18; i++) await driver.swipeDown(); // idx0 -> idx18 "▸ More"
    await driver.tap();
    await driver.waitForLine(/NAV\s+page 2\/2 on tasks-next-7-days/, { from: cursor });
    const page2 = await driver.waitForLine(
      /RENDER full mode=list screen=tasks-next-7-days\s+items=(\d+)/,
      { from: cursor },
    );
    // 7 remaining items + one "◂ Prev" row.
    expect(Number(/items=(\d+)/.exec(page2.message)?.[1])).toBe(8);
    assertLit(await driver.screenshotGlasses(), '06-glasses-list-page2');

    cursor = await driver.latestId();
    await driver.tap(); // idx0 = "◂ Prev" on page 2
    await driver.waitForLine(/NAV\s+page 1\/2 on tasks-next-7-days/, { from: cursor });
    expect(await driver.currentScreen()).toBe('tasks-next-7-days');
  });
});
