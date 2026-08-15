/**
 * Add Task (Voice) state machine: idle -> recording -> processing -> confirm
 * -> done/error. Driven through the add-task screen's dispatch, with the
 * mocked stt module's fireStop/fireFinal standing in for the VAD/Vosk
 * callbacks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { createTask } from '../../../api';
import * as stt from '../../../stt';
import { refreshVoiceStatus } from '../../../voice-runtime';
import type { SttController } from '../fakes';
import { back, mount, select } from '../harness';

const fakeStt = stt as unknown as SttController;

function openAddTask(h: ReturnType<typeof mount>) {
  h.ctx.navigate('add-task'); // navigate() resets the recording fields, same as production
}

describe('starting a recording', () => {
  it('goes idle -> recording once the recognizer is ready', async () => {
    const h = mount();
    openAddTask(h);

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('recording');
    expect(stt.isListening()).toBe(true);
  });

  it('goes to error when the backend never becomes ready', async () => {
    fakeStt.setReady(false);
    const h = mount();
    openAddTask(h);

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('error');
    expect(h.state.errorMessage).toContain('Voice input unavailable');
  });
});

describe('the gate on an unconfigured backend', () => {
  // Every case here is fixed on the phone, so a tap on the glasses must not
  // start anything — the screen explains what to do instead.
  it.each([
    'off',
    'needs-download',
    'needs-key',
    'preparing',
    'unknown',
  ] as const)('ignores a tap and starts nothing when voice is %s', async (status) => {
    const h = mount();
    openAddTask(h);
    h.state.voice = status;

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('idle');
    expect(stt.isListening()).toBe(false);
    expect(stt.ensureReady).not.toHaveBeenCalled();
  });

  it('records normally once a backend is configured', async () => {
    const h = mount();
    openAddTask(h);
    h.state.voice = 'ready';

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('recording');
  });

  it('closes the mic if the backend drops out after it said it was ready', async () => {
    // The realistic case is a Soniox key that connects and is then rejected:
    // ensureReady() has already resolved true by the time the 401 arrives.
    const h = mount();
    openAddTask(h);
    vi.mocked(stt.startListening).mockImplementationOnce(() => {
      /* socket died — no session started */
    });

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('error');
    expect(h.state.errorMessage).toContain('Voice input unavailable');
    expect(h.bridge.audioControl).toHaveBeenLastCalledWith(false);
  });
});

describe('ending a recording (VAD auto-stop or manual tap)', () => {
  it('VAD stop -> processing, then a non-empty transcript -> confirm', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();

    fakeStt.fireStop();
    expect(h.state.recording).toBe('processing');

    fakeStt.fireFinal('buy milk');
    expect(h.state.recording).toBe('confirm');
    expect(h.state.pendingTranscript).toBe('buy milk');

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain('"buy milk"');
  });

  it('an empty transcript goes to error', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();

    fakeStt.fireStop();
    fakeStt.fireFinal('');

    expect(h.state.recording).toBe('error');
    expect(h.state.errorMessage).toContain("Couldn't hear anything");
  });

  it('tapping again while recording manually stops (same path as VAD)', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    expect(h.state.recording).toBe('recording');

    h.dispatch(select()); // manual stop tap

    expect(h.state.recording).toBe('processing');
    expect(stt.isListening()).toBe(false);
  });

  it('still manually stops when voice is turned off mid-recording', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    expect(h.state.recording).toBe('recording');

    h.state.voice = 'off';
    h.dispatch(select());

    expect(h.state.recording).toBe('processing');
    expect(stt.stopListening).toHaveBeenCalled();
  });
});

describe('confirming the transcribed task', () => {
  it('creates the task and moves to done', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    fakeStt.fireStop();
    fakeStt.fireFinal('buy milk');

    h.dispatch(select()); // confirm tap

    expect(h.state.recording).toBe('confirming');
    expect(h.state.spinnerFrame).not.toBe('');

    await h.settle();

    expect(h.state.recording).toBe('done');
    expect(h.state.createdTaskName).toBe('buy milk');
    expect(h.state.pendingTranscript).toBe('');
    expect(h.state.spinnerFrame).toBe('');
  });

  it('on API failure, goes to error and clears the transcript', async () => {
    vi.mocked(createTask).mockRejectedValue(new Error('offline'));
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    fakeStt.fireStop();
    fakeStt.fireFinal('buy milk');

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('error');
    expect(h.state.errorMessage).toBe('offline');
    expect(h.state.pendingTranscript).toBe('');
  });

  it('double-tap discards the transcript and returns to idle to re-record', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    fakeStt.fireStop();
    fakeStt.fireFinal('buy milk');

    h.dispatch(back());

    expect(h.state.recording).toBe('idle');
    expect(h.state.pendingTranscript).toBe('');
    expect(h.state.screen).toBe('add-task');
  });

  it('still saves when voice is turned off before confirm', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    fakeStt.fireStop();
    fakeStt.fireFinal('buy milk');

    h.state.voice = 'off';
    h.dispatch(select());

    expect(h.state.recording).toBe('confirming');
    await h.settle();

    expect(h.state.recording).toBe('done');
    expect(createTask).toHaveBeenCalledWith('buy milk');
  });
});

describe('cancelling out of a recording', () => {
  it('GO_BACK while recording stops listening and returns to the tasks menu', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    expect(h.state.recording).toBe('recording');

    h.dispatch(back());

    expect(stt.isListening()).toBe(false);
    expect(h.bridge.audioControl).toHaveBeenLastCalledWith(false);
    expect(h.state.screen).toBe('tasks-menu');
  });

  it('GO_BACK after the backend was disposed still closes the mic', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    expect(h.state.recording).toBe('recording');

    stt.dispose();
    expect(stt.isListening()).toBe(false);

    h.dispatch(back());

    expect(h.bridge.audioControl).toHaveBeenLastCalledWith(false);
    expect(h.state.screen).toBe('tasks-menu');
  });
});

describe('voice settings changing mid-recording', () => {
  it('refreshVoiceStatus abandons recording and closes the mic', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    expect(h.state.recording).toBe('recording');

    await refreshVoiceStatus({ mode: 'off' });

    expect(stt.applyVoiceConfig).toHaveBeenCalled();
    expect(h.bridge.audioControl).toHaveBeenLastCalledWith(false);
    expect(h.state.recording).toBe('idle');
    expect(h.state.voice).toBe('off');
  });

  it('refreshVoiceStatus leaves confirm alone', async () => {
    const h = mount();
    openAddTask(h);
    h.dispatch(select());
    await h.settle();
    fakeStt.fireStop();
    fakeStt.fireFinal('buy milk');
    expect(h.state.recording).toBe('confirm');

    await refreshVoiceStatus({ mode: 'off' });

    expect(h.state.recording).toBe('confirm');
    expect(h.state.pendingTranscript).toBe('buy milk');
  });
});

beforeEach(() => {
  fakeStt.reset();
  vi.mocked(createTask).mockImplementation(async (name: string) => ({ id: 't1', name }));
});

afterEach(() => {
  vi.clearAllMocks();
});
