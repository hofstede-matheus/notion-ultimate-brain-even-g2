/**
 * Mark-done confirm/toast flow, reached from the task action menu.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { markTaskDone } from '../../../api';
import { back, mount, select } from '../harness';

const TASK = { id: 't1', name: 'Buy milk' };

function openConfirm(h: ReturnType<typeof mount>) {
  h.state.screen = 'inbox';
  h.state.lists.inbox = [TASK];
  h.dispatch(select(0)); // -> task-actions
  h.dispatch(select(2)); // Mark as done
}

describe('opening the confirm dialog', () => {
  it('sets pendingAction and navigates to mark-done-confirm', () => {
    const h = mount();
    openConfirm(h);

    expect(h.state.pendingAction).toEqual({
      kind: 'markDone',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
    });
    expect(h.state.screen).toBe('mark-done-confirm');
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Confirm: Buy milk', 'Cancel'] });
  });

  it('Cancel dismisses back to the returnTo screen', () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(select(1)); // Cancel

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });

  it('GO_BACK also dismisses', () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(back());

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });
});

describe('confirming mark-done', () => {
  it('calls markTaskDone, removes the item from its list, and shows the toast', async () => {
    vi.mocked(markTaskDone).mockResolvedValue(undefined);
    const h = mount();
    openConfirm(h);

    h.dispatch(select(0)); // Confirm

    expect(h.state.spinnerFrame).not.toBe('');

    await h.settle();

    expect(markTaskDone).toHaveBeenCalledWith('t1');
    expect(h.state.lists.inbox).toEqual([]);
    expect(h.state.pendingAction).toBeNull();
    expect(h.state.actionToast).toMatchObject({ kind: 'markDone', itemName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('mark-done-toast');
    expect(h.render()).toMatchObject({ mode: 'text' });
    expect(h.state.spinnerFrame).toBe('');
  });

  it('auto-returns to the list 1.5s after the toast', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(markTaskDone).mockResolvedValue(undefined);
      const h = mount();
      openConfirm(h);

      h.dispatch(select(0));
      await h.settle();
      expect(h.state.screen).toBe('mark-done-toast');

      vi.advanceTimersByTime(1500);

      expect(h.state.actionToast).toBeNull();
      expect(h.state.screen).toBe('inbox');
    } finally {
      vi.useRealTimers();
    }
  });

  it('an early GO_BACK on the toast returns immediately, without a second auto-return', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(markTaskDone).mockResolvedValue(undefined);
      const h = mount();
      openConfirm(h);
      h.dispatch(select(0));
      await h.settle();

      h.dispatch(back());
      expect(h.state.screen).toBe('inbox');

      // The 1.5s timer must have been cleared — advancing it must not blow up
      // or re-navigate away from wherever the user is now.
      h.state.screen = 'tasks-menu';
      vi.advanceTimersByTime(1500);
      expect(h.state.screen).toBe('tasks-menu');
    } finally {
      vi.useRealTimers();
    }
  });

  it('on API failure, shows the error and stays on the confirm screen', async () => {
    vi.mocked(markTaskDone).mockRejectedValue(new Error('offline'));
    const h = mount();
    openConfirm(h);

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.errorMessage).toBe('offline');
    expect(h.state.pendingAction).not.toBeNull();
    expect(h.state.screen).toBe('mark-done-confirm');
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('FAILED: offline');
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(markTaskDone).mockResolvedValue(undefined);
});
