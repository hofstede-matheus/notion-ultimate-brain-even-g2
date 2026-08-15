/**
 * What the Add Task screen shows before a speech backend is configured.
 *
 * The "Add Task (Voice)" row deliberately stays in the Tasks menu whether or
 * not voice works — hiding it would renumber the menu (makeMenuScreen selects
 * by index) and leave the feature undiscoverable. So this screen carries the
 * explanation instead, and every fix lives on the phone.
 */

import { describe, expect, it } from 'vitest';

import { mount, select } from '../harness';

function contentFor(voice: (typeof STATUSES)[number]): string {
  const h = mount();
  h.state.screen = 'add-task';
  h.state.voice = voice;
  const display = h.render();
  if (display.mode !== 'text') throw new Error(`expected a text screen, got ${display.mode}`);
  return display.content;
}

const STATUSES = ['off', 'needs-download', 'needs-key', 'preparing', 'unknown'] as const;

describe('add task — no backend configured', () => {
  it.each(STATUSES)('points the user at their phone when voice is %s', (status) => {
    const content = contentFor(status);
    expect(content).toContain('ADD TASK');
    expect(content).not.toContain('Tap to start recording');
  });

  it('names the one-time download when the model is missing', () => {
    const content = contentFor('needs-download');
    expect(content).toContain('one-time download');
    expect(content).toContain('Settings');
  });

  it('names the API key when cloud mode has none', () => {
    const content = contentFor('needs-key');
    expect(content).toContain('Soniox API key');
    expect(content).toContain('Settings');
  });

  it('says voice is off when no mode is chosen', () => {
    expect(contentFor('off')).toContain('Voice input is off');
  });

  it('says the model is loading while it warms up', () => {
    expect(contentFor('preparing')).toContain('loading');
  });

  it('offers the normal recording prompt once ready', () => {
    const h = mount();
    h.state.screen = 'add-task';
    h.state.voice = 'ready';
    const display = h.render();
    if (display.mode !== 'text') throw new Error('expected a text screen');
    expect(display.content).toContain('Tap to start recording');
  });

  it('leaves the screen on a tap instead of starting a dead recording', async () => {
    const h = mount();
    h.ctx.navigate('add-task');
    h.state.voice = 'needs-download';

    h.dispatch(select());
    await h.settle();

    expect(h.state.recording).toBe('idle');
    expect(h.state.screen).toBe('add-task');
  });

  it('still goes back on a double-tap', async () => {
    const h = mount();
    h.ctx.navigate('add-task');
    h.state.voice = 'off';

    h.dispatch({ type: 'GO_BACK' });
    await h.settle();

    expect(h.state.screen).toBe('tasks-menu');
  });
});
