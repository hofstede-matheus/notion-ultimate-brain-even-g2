/**
 * "Rendered on the device" has two layers: router.toDisplayData(state) is
 * the pure, no-bridge check every other test in this suite already leans on
 * via h.render() — this file pins a couple of representative shapes
 * directly. The second layer, here, is the one wiring test: does
 * renderFull() actually hand the bridge the display data it computed.
 */

import type { RebuildPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { renderFull, renderUpdate } from '../../../glasses/render';
import { router } from '../../../glasses/router';
import { mount } from '../harness';

describe('router.toDisplayData — pure, no bridge involved', () => {
  it('a list screen with items renders list mode', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];

    expect(router.toDisplayData(h.state)).toMatchObject({ mode: 'list', items: ['Buy milk'] });
  });

  it('a loading list screen renders text mode with the loading message', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.loading = true;

    expect(router.toDisplayData(h.state)).toMatchObject({ mode: 'text' });
  });

  it('an unknown screen name falls back to the root menu', () => {
    const h = mount();
    // @ts-expect-error deliberately invalid — exercising the fallback path
    h.state.screen = 'not-a-real-screen';

    expect(router.toDisplayData(h.state)).toMatchObject({
      mode: 'list',
      items: ['Tasks', 'Notes', 'Projects', 'Tags'],
    });
  });
});

describe('renderFull — the bridge wiring', () => {
  it('sends the current display as a full rebuild on the first call (startup)', async () => {
    const h = mount();
    h.state.screen = 'menu';
    h.state.startupRendered = false;

    await renderFull();

    expect(h.bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1);
    expect(h.bridge.rebuildPageContainer).not.toHaveBeenCalled();
    expect(h.state.startupRendered).toBe(true);
  });

  it('sends a rebuild (not startup) on subsequent calls, with the list items in the payload', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.state.startupRendered = true;

    await renderFull();

    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
    const arg = h.bridge.rebuildPageContainer.mock.calls[0]?.[0] as RebuildPageContainer;
    expect(arg.listObject?.[0]?.itemContainer?.itemName).toContain('Buy milk');
  });

  it('renderUpdate sends a header-only upgrade and is a no-op if the screen changed', async () => {
    const h = mount();
    h.state.screen = 'task-metadata';
    h.state.taskMetadata = { loading: true, project: null, due: null, error: '' };

    await renderUpdate('task-metadata');
    expect(h.bridge.textContainerUpgrade).toHaveBeenCalledTimes(1);
    const arg = h.bridge.textContainerUpgrade.mock.calls[0]?.[0] as TextContainerUpgrade;
    expect(arg.content).toContain('Loading');

    h.state.screen = 'menu';
    await renderUpdate('task-metadata'); // stale — user navigated away
    expect(h.bridge.textContainerUpgrade).toHaveBeenCalledTimes(1); // unchanged
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
