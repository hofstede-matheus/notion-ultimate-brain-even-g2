import { describe, expect, it } from 'vitest';
import { assertLit } from '../driver/app';
import { driver } from './_setup';

/**
 * docs/features/glasses/root-menu.feature, startup.feature.
 *
 * Boot is the one flow every other spec depends on, so it gets its own
 * check: the app reached the real menu screen through the real SDK bridge
 * (createStartUpPageContainer accepted, four containers painted), not just
 * that toDisplayData() computed the right object — see the unit suite for
 * that half.
 */
describe('boot and root menu', () => {
  it('boots to the four-item root menu with something actually painted', async () => {
    const bootLine = await driver.hasLine(/BOOT\s+glasses started/);
    expect(bootLine, 'expected a BOOT glasses started line from setup').toBeDefined();

    const menuRender = await driver.hasLine(/RENDER full mode=list screen=menu\s+items=4/);
    expect(menuRender, 'expected the root menu to render with 4 items').toBeDefined();

    expect(await driver.currentScreen()).toBe('menu');

    assertLit(await driver.screenshotGlasses(), '01-glasses-menu');
    assertLit(await driver.screenshotWebview(), '01-webview-menu');
  });
});
