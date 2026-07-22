/**
 * Delete confirm/toast flow, reached from the note action menu — the same
 * shared screens tasks/delete.test.ts exercises from the task side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { deletePage } from '../../../api';
import { back, mount, select } from '../harness';

const NOTE = { id: 'n1', name: 'Meeting recap' };

function openConfirm(h: ReturnType<typeof mount>) {
  h.state.screen = 'notes-inbox';
  h.state.lists['notes-inbox'] = [NOTE];
  h.dispatch(select(0)); // -> note-actions
  h.dispatch(select(2)); // Delete note
}

describe('opening the delete confirm dialog from a note', () => {
  it('sets pendingAction and navigates to delete-confirm', () => {
    const h = mount();
    openConfirm(h);

    expect(h.state.pendingAction).toEqual({
      kind: 'delete',
      itemId: 'n1',
      itemName: 'Meeting recap',
      returnTo: 'notes-inbox',
    });
    expect(h.state.screen).toBe('delete-confirm');
  });
});

describe('confirming delete', () => {
  it('calls deletePage, removes the note from its list, and shows the toast', async () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(select(0));
    await h.settle();

    expect(deletePage).toHaveBeenCalledWith('n1');
    expect(h.state.lists['notes-inbox']).toEqual([]);
    expect(h.state.screen).toBe('delete-toast');
  });

  it('Cancel dismisses back to the note list', () => {
    const h = mount();
    openConfirm(h);

    h.dispatch(select(1));

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('notes-inbox');
  });

  it('GO_BACK on the toast dismisses immediately', async () => {
    const h = mount();
    openConfirm(h);
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.actionToast).toBeNull();
    expect(h.state.screen).toBe('notes-inbox');
  });
});

beforeEach(() => {
  vi.mocked(deletePage).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});
