/**
 * "Rendered on the device" has two layers: router.toDisplayData(state) is
 * the pure, no-bridge check every other test in this suite already leans on
 * via h.render() — this file pins a couple of representative shapes
 * directly. The second layer, here, is the one wiring test: does
 * renderFull() actually hand the bridge the display data it computed.
 */

import {
  type ImageContainerProperty,
  type ImageRawDataUpdate,
  type RebuildPageContainer,
  StartUpPageCreateResult,
  type TextContainerProperty,
  type TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { CONTAINER_ID_CAL_TOP } from '../../../glasses/constants';
import { renderFull, renderUpdate, StartupRejectedError } from '../../../glasses/render';
import { router } from '../../../glasses/router';
import { clear as clearLog, getSnapshot as getLogSnapshot } from '../../../logging/sink';
import { mount, move, select } from '../harness';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T12:00:00'));
  clearLog();
});

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

  it('a text/list screen carries no calendar containers at all', async () => {
    const h = mount();
    h.state.screen = 'menu';
    h.state.startupRendered = true;

    await renderFull();

    const arg = h.bridge.rebuildPageContainer.mock.calls[0]?.[0] as RebuildPageContainer;
    expect(arg.containerTotalNum).toBe(2);
    expect(arg.imageObject ?? []).toHaveLength(0);
    expect(h.bridge.updateImageRawData).not.toHaveBeenCalled();
  });

  it('the due-date picker opens as a full-screen event sink behind 4 image tiles, sends all 4 on open, then skips unchanged tiles on a redundant render', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(select(0)); // -> task-actions
    h.dispatch(select(2)); // Change due date -> task-due-date, triggers the initial renderFull
    await h.settle();

    const arg = h.bridge.rebuildPageContainer.mock.calls.at(-1)?.[0] as RebuildPageContainer;
    expect(arg.containerTotalNum).toBe(8);

    // Regression test for the swipe-scrolls-the-text-panel bug: container
    // id=1 must be a non-overflowing ' ' sink with sole event capture, not a
    // content-bearing container that can trigger the firmware's internal
    // scroll and eat swipes.
    const sink = arg.textObject?.find((t: TextContainerProperty) => t.containerID === 1);
    expect(sink).toMatchObject({ content: ' ', isEventCapture: 1, width: 576, height: 288 });
    const otherCapturing = arg.textObject?.filter(
      (t: TextContainerProperty) => t.containerID !== 1 && t.isEventCapture === 1,
    );
    expect(otherCapturing).toHaveLength(0);

    const images = arg.imageObject as ImageContainerProperty[];
    expect(images).toHaveLength(4);
    for (const img of images) {
      expect(img.width).toBe(288);
      expect(img.height).toBe(102);
    }
    expect(h.bridge.updateImageRawData).toHaveBeenCalledTimes(4);
    const calls = h.bridge.updateImageRawData.mock.calls.map(
      ([data]) => data as ImageRawDataUpdate,
    );
    expect(calls.map((c) => c.containerName)).toEqual([
      'ub-cal-a',
      'ub-cal-b',
      'ub-cal-c',
      'ub-cal-d',
    ]);

    h.bridge.updateImageRawData.mockClear();
    await renderFull(); // same picker state — nothing changed

    expect(h.bridge.updateImageRawData).not.toHaveBeenCalled();
  });

  it('a cursor move within the picker does not rebuild the page container', async () => {
    // Regression test: rebuildPageContainer re-declares the image
    // containers, which resets them. If a cursor move re-issues it, then
    // sendCalendarTiles's per-tile skip (for tiles the move didn't touch)
    // leaves those tiles blank on the device even though nothing told the
    // app anything was wrong — exactly the "half the calendar disappears"
    // bug this test guards against.
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(select(0)); // -> task-actions
    h.dispatch(select(2)); // Change due date -> task-due-date
    await h.settle();

    h.bridge.rebuildPageContainer.mockClear();
    h.bridge.createStartUpPageContainer.mockClear();
    h.bridge.updateImageRawData.mockClear();

    h.dispatch(move('down')); // moves the week cursor, triggers renderFull again
    await h.settle();

    expect(h.bridge.rebuildPageContainer).not.toHaveBeenCalled();
    expect(h.bridge.createStartUpPageContainer).not.toHaveBeenCalled();
    // The row band spans the full width, so both tile columns' pixels
    // change — but critically, this must go through updateImageRawData,
    // never through a container rebuild.
    expect(h.bridge.updateImageRawData.mock.calls.length).toBeGreaterThan(0);
  });

  it('paging the month updates the top label via textContainerUpgrade, not a rebuild', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(select(0));
    h.dispatch(select(2));
    await h.settle();

    const picker = h.state.dueDatePicker;
    if (!picker) throw new Error('expected dueDatePicker to be open');
    picker.rowIndex = 7; // "next month" nav row

    h.bridge.rebuildPageContainer.mockClear();
    h.bridge.textContainerUpgrade.mockClear();

    h.dispatch(select()); // tap -> pages the month, still week phase
    await h.settle();

    expect(h.bridge.rebuildPageContainer).not.toHaveBeenCalled();
    const arg = h.bridge.textContainerUpgrade.mock.calls.find(
      ([call]) => (call as TextContainerUpgrade).containerID === CONTAINER_ID_CAL_TOP,
    )?.[0] as TextContainerUpgrade | undefined;
    expect(arg?.content).toContain('AUGUST 2026');
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

describe('renderFull — startup/rebuild/upgrade result codes are checked, not discarded', () => {
  it('a non-success startup result leaves startupRendered false, throws, and logs the code', async () => {
    const h = mount();
    h.state.screen = 'menu';
    h.state.startupRendered = false;
    h.bridge.createStartUpPageContainer.mockResolvedValueOnce(StartUpPageCreateResult.oversize);

    await expect(renderFull()).rejects.toThrow(StartupRejectedError);

    expect(h.state.startupRendered).toBe(false);
    const errors = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.msg).toContain('oversize');
  });

  it('a retry after a rejected startup attempts createStartUpPageContainer again', async () => {
    const h = mount();
    h.state.screen = 'menu';
    h.state.startupRendered = false;
    h.bridge.createStartUpPageContainer.mockResolvedValueOnce(StartUpPageCreateResult.invalid);

    await expect(renderFull()).rejects.toThrow(StartupRejectedError);
    expect(h.bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1);

    h.bridge.createStartUpPageContainer.mockResolvedValueOnce(StartUpPageCreateResult.success);
    await renderFull();

    expect(h.bridge.createStartUpPageContainer).toHaveBeenCalledTimes(2);
    expect(h.state.startupRendered).toBe(true);
  });

  it('rebuildPageContainer resolving false logs a warning without throwing', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.state.startupRendered = true;
    h.bridge.rebuildPageContainer.mockResolvedValueOnce(false);

    await expect(renderFull()).resolves.toBeUndefined();

    const warnings = getLogSnapshot().filter((r) => r.level === 'warn');
    expect(warnings.some((r) => r.msg.includes('rebuildPageContainer rejected'))).toBe(true);
  });

  it('textContainerUpgrade resolving false logs a warning without throwing', async () => {
    const h = mount();
    h.state.screen = 'task-metadata';
    h.state.taskMetadata = { loading: true, project: null, due: null, error: '' };
    h.bridge.textContainerUpgrade.mockResolvedValueOnce(false);

    await expect(renderUpdate('task-metadata')).resolves.toBeUndefined();

    const warnings = getLogSnapshot().filter((r) => r.level === 'warn');
    expect(warnings.some((r) => r.msg.includes('header textContainerUpgrade rejected'))).toBe(true);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
