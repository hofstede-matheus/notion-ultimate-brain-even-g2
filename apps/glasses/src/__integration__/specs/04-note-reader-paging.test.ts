import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/a-note/open-page/reading.feature,
 * how-a-page-reads.feature.
 *
 * The reader is a `mode: 'text'` screen, not a native list — it has no
 * byte-cap backstop (see page-content-screen.ts), so an over-long page is a
 * layout bug the simulator can catch (re-arming firmware scroll, per
 * CLAUDE.md's Gotchas) that a mocked bridge cannot: the unit suite already
 * covers the markdown->lines math in content/markdown-to-pages.test.ts, but
 * nothing until now confirms the paginated result actually paints.
 */
describe('note reader pages a long note', () => {
  it('notes -> Inbox -> tap a row -> opens its page directly -> swipe turns the page', async () => {
    let cursor = await driver.latestId();
    await driver.swipeDown(); // root menu idx0 -> idx1 "Notes"
    await driver.tap();
    await driver.waitForLine(/NAV\s+menu -> notes-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // notes-menu idx0 "Inbox"
    await driver.waitForLine(/RENDER full mode=list screen=notes-inbox/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Reading Test Note" — opens its details
    await driver.waitForLine(/SEL\s+notes-inbox row 0 "Reading Test Note"/, { from: cursor });
    await driver.waitForLine(/NAV\s+notes-inbox -> note-details/, { from: cursor });

    // Reading the page is the first item on the note's contextual menu — NOTE_CONTEXT_MENU
    // order: Open page, Change project, Delete note (see glasses/context-menu.ts).
    cursor = await driver.latestId();
    await driver.holdToOpenContextMenu();
    await driver.selectContextMenuItem(0);
    await driver.waitForLine(/NAV\s+openPage "Reading Test Note"/, { from: cursor });
    const loaded = await driver.waitForLine(/NAV\s+openPage "Reading Test Note" loaded/, {
      from: cursor,
      timeoutMs: 15_000,
    });
    expect(loaded.message).toMatch(/pages=(\d+)/);
    const pageCount = Number(/pages=(\d+)/.exec(loaded.message)?.[1] ?? '0');
    expect(pageCount).toBeGreaterThan(1); // the fixture prose is long enough to force paging

    expect(await driver.currentScreen()).toBe('page-content');
    assertLit(await driver.screenshotGlasses(), '04-glasses-reader-page1');

    cursor = await driver.latestId();
    await driver.swipeDown(); // turnPage(1)
    await driver.waitForLine(/NAV\s+page reader 2\//, { from: cursor });
    assertLit(await driver.screenshotGlasses(), '04-glasses-reader-page2');
  });
});
