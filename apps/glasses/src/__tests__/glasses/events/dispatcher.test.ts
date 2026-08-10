/**
 * events/index.ts — the SDK event listener wiring (startGlasses,
 * onEvenHubEvent). Everything else in this suite exercises router actions
 * directly via harness.dispatch(); this file is the one that goes through
 * the actual bridge.onEvenHubEvent(...) subscription, via harness.emit().
 */
import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { flush } = vi.hoisted(() => ({ flush: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../logging/persist', () => ({ flush }));

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import {
  attachGlassesListeners,
  showGlassesScreen,
  startGlasses,
} from '../../../glasses/events';
import { clear as clearLog } from '../../../logging/sink';
import { mount } from '../harness';

/** Builds a partial EvenHubEvent for tests — the SDK's nested types are classes with a toJson() method tests don't need. */
function ev(partial: Partial<EvenHubEvent>): EvenHubEvent {
  return partial as EvenHubEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearLog();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startGlasses', () => {
  it('attaches listeners before rendering a requested screen', async () => {
    const h = mount();
    h.state.startupRendered = true;

    attachGlassesListeners();
    await showGlassesScreen('booting');

    expect(h.bridge.onEvenHubEvent).toHaveBeenCalledTimes(1);
    expect(h.state.screen).toBe('booting');
    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });

  it('subscribes to onEvenHubEvent and renders the initial menu screen', async () => {
    const h = mount();
    h.state.startupRendered = true;

    await startGlasses();

    expect(h.bridge.onEvenHubEvent).toHaveBeenCalledTimes(1);
    expect(h.state.screen).toBe('menu');
    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the previous listener before re-subscribing on a second call', async () => {
    const h = mount();
    h.state.startupRendered = true;
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    h.bridge.onEvenHubEvent.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    await startGlasses();
    await startGlasses();

    expect(h.bridge.onEvenHubEvent).toHaveBeenCalledTimes(2);
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(unsub2).not.toHaveBeenCalled();
  });

  it('a gesture only dispatches once even after a second startGlasses() call', async () => {
    const h = mount();
    h.state.startupRendered = true;
    h.state.screen = 'tasks-menu';

    await startGlasses();
    await startGlasses();
    h.state.screen = 'tasks-menu';
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ listEvent: { currentSelectItemIndex: 0 } as never }));
    await h.settle();

    // A double subscription would fire router.onGlassAction twice, which
    // (for a navigating action) means two renders instead of one.
    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });
});

describe('lifecycle events', () => {
  it('FOREGROUND_ENTER_EVENT redraws the current screen', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as never }));
    await h.settle();

    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });

  it('FOREGROUND_EXIT_EVENT flushes the log', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT } as never }));
    await h.settle();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ABNORMAL_EXIT_EVENT', OsEventTypeList.ABNORMAL_EXIT_EVENT],
    ['SYSTEM_EXIT_EVENT', OsEventTypeList.SYSTEM_EXIT_EVENT],
  ])('%s stops the mic and unsubscribes', async (_name, eventType) => {
    const h = mount();
    h.state.startupRendered = true;
    const unsubscribe = vi.fn();
    h.bridge.onEvenHubEvent.mockReturnValueOnce(unsubscribe);
    await startGlasses();

    h.emit(ev({ sysEvent: { eventType } as never }));
    await h.settle();

    expect(h.bridge.audioControl).toHaveBeenCalledWith(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('a second startGlasses() after teardown re-subscribes cleanly', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();

    h.emit(ev({ sysEvent: { eventType: OsEventTypeList.SYSTEM_EXIT_EVENT } as never }));
    await h.settle();

    await startGlasses();
    h.bridge.rebuildPageContainer.mockClear();
    h.state.screen = 'tasks-menu';

    h.emit(ev({ listEvent: { currentSelectItemIndex: 0 } as never }));
    await h.settle();

    expect(h.bridge.rebuildPageContainer).toHaveBeenCalledTimes(1);
  });
});

describe('audio routing', () => {
  it('routes audioEvent PCM to stt.feedAudio while listening, bypassing action dispatch', async () => {
    const h = mount();
    h.state.startupRendered = true;
    await startGlasses();
    const stt = await import('../../../stt');
    vi.mocked(stt.isListening).mockReturnValue(true);
    h.bridge.rebuildPageContainer.mockClear();

    h.emit(ev({ audioEvent: { source: 'glasses', audioPcm: new Uint8Array([1, 2, 3]) } as never }));
    await h.settle();

    expect(stt.feedAudio).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(h.bridge.rebuildPageContainer).not.toHaveBeenCalled();
  });
});
