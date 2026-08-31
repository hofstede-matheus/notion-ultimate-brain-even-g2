// @vitest-environment jsdom
/**
 * Integration coverage for the phone status/settings-entry screen's "What's
 * New" flow. whatsNew.test.ts already pins the pure isDismissed/
 * loadDismissedWhatsNew/dismissWhatsNew logic against a mocked bridge; this
 * file instead renders the real component tree — StatusScreen, its
 * useUiState/UiStateProvider wiring, and the real WhatsNew card — against
 * real jsdom `window.localStorage`, with no bridge installed (state.ts's
 * `_bridge` defaults to null). That proves three things no pure-logic test
 * can: the async dismissed-ids read actually flips React state and
 * re-renders, a real click actually reaches `dismissWhatsNew`, and the
 * bridge-absent fallback (a browser tab with no Even Hub bridge, e.g. this
 * webview opened outside the app) round-trips through a real Storage object
 * rather than a mocked one.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiStateProvider } from '../../web/providers/UiStateProvider';
import { StatusScreen } from '../../web/screens/StatusScreen';
import { WHATS_NEW_ENTRY } from '../../web/whats-new';

const STORAGE_KEY = 'notionultimatebrain:whatsnew-dismissed';

function renderStatusScreen() {
  return render(
    <UiStateProvider>
      <StatusScreen />
    </UiStateProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // @testing-library/react's own auto-cleanup only registers when `afterEach`
  // is a vitest global (test.globals: true) — it isn't here, so each render()
  // would otherwise pile up in the same jsdom document across tests.
  cleanup();
  window.localStorage.clear();
});

describe("StatusScreen — What's New card", () => {
  it('shows the card once the dismissed-ids read resolves, with nothing dismissed yet', async () => {
    renderStatusScreen();

    expect(await screen.findByText(WHATS_NEW_ENTRY.title)).toBeInTheDocument();
    for (const bullet of WHATS_NEW_ENTRY.bullets) {
      expect(screen.getByText(bullet)).toBeInTheDocument();
    }
    // The rest of the screen rendered too — the card doesn't replace it.
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('tapping "Got it" hides the card immediately and persists the dismissal to real localStorage', async () => {
    const user = userEvent.setup();
    renderStatusScreen();
    await screen.findByText(WHATS_NEW_ENTRY.title);

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.queryByText(WHATS_NEW_ENTRY.title)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([WHATS_NEW_ENTRY.id]));
    });
  });

  it('stays hidden on a fresh mount once real localStorage already has the id dismissed', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([WHATS_NEW_ENTRY.id]));

    renderStatusScreen();

    // Give the async load a chance to resolve before asserting a negative.
    await waitFor(() => expect(screen.getByText('Connecting...')).toBeInTheDocument());
    expect(screen.queryByText(WHATS_NEW_ENTRY.title)).not.toBeInTheDocument();
  });

  it('does not blank the rest of the screen when localStorage holds corrupt data', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');

    renderStatusScreen();

    // Falls back to "nothing dismissed" — the card still shows, and the
    // storage failure doesn't take the rest of the screen down with it.
    expect(await screen.findByText(WHATS_NEW_ENTRY.title)).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });
});
