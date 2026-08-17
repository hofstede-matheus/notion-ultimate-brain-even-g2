import { describe, expect, it } from 'vitest';
import { FIXTURE_URL } from '../env';
import { driver } from './_setup';

/**
 * docs/features/glasses/notes/a-note/delete-note/confirm.feature,
 * confirming-a-change.feature.
 *
 * The mutation pipeline from the *notes* side. Spec 03 covers the same
 * confirm→toast machinery for a task, but the note action menu is ordered
 * differently ("Open page" first, delete at idx 3, no mark-done row) and this
 * hits a different verb and endpoint — DELETE /api/pages/:id rather than
 * PATCH /api/tasks/:id/done.
 *
 * The fixture list is static, so deleting note-delete here does not remove it
 * for any later spec: the toast's auto-refetch restores the full list.
 */
describe('note delete round trip', () => {
  it('confirm -> DELETE /api/pages/:id -> toast -> back to the inbox', async () => {
    await fetch(`${FIXTURE_URL}/__reset`, { method: 'POST' });

    let cursor = await driver.latestId();
    await driver.swipeDown(); // root menu idx0 -> idx1 "Notes"
    await driver.tap();
    await driver.waitForLine(/NAV\s+menu -> notes-menu/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // notes-menu idx0 "Inbox"
    await driver.waitForLine(/RENDER full mode=list screen=notes-inbox/, { from: cursor });

    cursor = await driver.latestId();
    await driver.swipeDown(); // row 0 -> row 1 "Disposable Note"
    await driver.tap();
    await driver.waitForLine(/SEL\s+notes-inbox row 1 "Disposable Note"/, { from: cursor });
    await driver.waitForLine(/NAV\s+notes-inbox -> note-actions/, { from: cursor });

    cursor = await driver.latestId();
    for (let i = 0; i < 3; i++) await driver.swipeDown(); // idx0 -> idx3 "Delete note"
    await driver.tap();
    await driver.waitForLine(/ACT\s+confirm open kind=delete/, { from: cursor });
    await driver.waitForLine(/NAV\s+note-actions -> delete-confirm/, { from: cursor });

    cursor = await driver.latestId();
    await driver.tap(); // idx0 "Confirm: Disposable Note"
    await driver.waitForLine(/ACT\s+calling delete api/, { from: cursor });
    await driver.waitForLine(/ACT\s+ok, applied to notes-inbox/, { from: cursor });
    await driver.waitForLine(/NAV\s+delete-confirm -> delete-toast/, { from: cursor });

    const { calls } = (await (await fetch(`${FIXTURE_URL}/__calls`)).json()) as {
      calls: { method: string; path: string }[];
    };
    expect(calls).toContainEqual({ method: 'DELETE', path: '/api/pages/note-delete' });

    // enterView logs NAV before the list paints; currentScreen() reads the
    // last RENDER line, so wait for that too (same as spec 03).
    await driver.waitForLine(/NAV\s+enterView\('notes-inbox'\)/, { from: cursor, timeoutMs: 4000 });
    await driver.waitForLine(/RENDER full mode=list screen=notes-inbox/, { from: cursor });
    expect(await driver.currentScreen()).toBe('notes-inbox');
  });
});
