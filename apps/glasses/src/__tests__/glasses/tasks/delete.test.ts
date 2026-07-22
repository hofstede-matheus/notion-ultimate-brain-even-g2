/**
 * Delete confirm/toast flow, reached from the task action menu. The screens
 * themselves (_shared/delete-confirm.ts, _shared/delete-toast.ts) are shared
 * with notes — see notes/delete.test.ts for that side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { deletePage } from '../../../api';
import { back, mount, select } from '../harness';

const TASK = { id: 't1', name: 'Buy milk' };

function openConfirm(h: ReturnType<typeof mount>) {
  h.state.screen = 'inbox';
  h.state.lists.inbox = [TASK];
  h.dispatch(select(0)); // -> task-actions
  h.dispatch(select(3)); // Delete task
}

describe('opening the delete confirm dialog from a task', () => {
  it('sets pendingAction and navigates to delete-confirm', () => {
    const h = mount();
    openConfirm(h);

    expect(h.state.pendingAction).toEqual({
      kind: 'delete',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
    });
    expect(h.state.screen).toBe('delete-confirm');
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Confirm: Buy milk', 'Cancel'] });
  });

  it('Cancel dismisses back to inbox', () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(select(1));

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });

  it('a long, multi-byte task name is truncated so the prefixed item stays within the native-list byte cap', () => {
    const longName = 'Preparação do relatório financeiro trimestral para a diretoria executiva';
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: longName }];
    h.dispatch(select(0));
    h.dispatch(select(3)); // Delete task

    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode !== 'list') return;
    const item = display.items[0];
    expect(new TextEncoder().encode(item).length).toBeLessThanOrEqual(63);
    expect(item.startsWith('Confirm: ')).toBe(true);
    expect(item.endsWith('…')).toBe(true); // proves truncation actually engaged
  });
});

describe('confirming delete', () => {
  it('calls deletePage, removes the item from its list, and shows the toast', async () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(select(0));

    expect(h.state.spinnerFrame).not.toBe('');

    await h.settle();

    expect(deletePage).toHaveBeenCalledWith('t1');
    expect(h.state.lists.inbox).toEqual([]);
    expect(h.state.actionToast).toMatchObject({ kind: 'delete', itemName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('delete-toast');
    expect(h.state.spinnerFrame).toBe('');
  });

  it('on API failure, shows the error and stays on the confirm screen', async () => {
    vi.mocked(deletePage).mockRejectedValue(new Error('offline'));
    const h = mount();
    openConfirm(h);

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.errorMessage).toBe('offline');
    expect(h.state.screen).toBe('delete-confirm');
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('FAILED: offline');
  });

  it('GO_BACK on the toast dismisses immediately', async () => {
    const h = mount();
    openConfirm(h);
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.actionToast).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });
});

beforeEach(() => {
  vi.mocked(deletePage).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});
