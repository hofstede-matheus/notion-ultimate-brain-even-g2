import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/tags/tag-lists.feature, a-tag/tag-notes.feature.
 *
 * Tags are the one drill-down with no intermediate action menu (tags/actions.ts
 * stashes the tag and enters its notes list in a single step) and the one list
 * whose header is built from the selected item (`TAG: <name>`). Both make this
 * a different SELECT_HIGHLIGHTED routing path — SelectKind 'tag' — than the
 * task/note/project specs cover.
 */
describe('tag drill-down', () => {
  it('menu -> Tags -> Recent -> a tag -> that tag’s notes', async () => {
    let cursor = await driver.latestId();
    for (let i = 0; i < 3; i++) await driver.swipeDown(); // root menu idx0 -> idx3 "Tags"
    await driver.tap();
    await driver.waitForLine(/NAV\s+menu -> tags-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // tags-menu idx0 "Recent"
    await driver.waitForLine(/API\s+.*\/api\/tags\/recent 200/, { from: cursor });
    const tagList = await driver.waitForLine(
      /RENDER full mode=list screen=tags-recent\s+items=(\d+)/,
      { from: cursor },
    );
    expect(Number(/items=(\d+)/.exec(tagList.message)?.[1])).toBe(2);

    cursor = await driver.latestId();
    await driver.tap(); // row 0 "Health"
    await driver.waitForLine(/SEL\s+tags-recent row 0 "Health"/, { from: cursor });
    await driver.waitForLine(/NAV\s+openTagNotes "Health"/, { from: cursor });
    await driver.waitForLine(/API\s+.*\/api\/notes\/for-tag\/tag-health 200/, { from: cursor });
    await driver.waitForLine(/RENDER full mode=list screen=tag-notes/, { from: cursor });

    expect(await driver.currentScreen()).toBe('tag-notes');
    assertLit(await driver.screenshotGlasses(), '08-glasses-tag-notes');
  });
});
