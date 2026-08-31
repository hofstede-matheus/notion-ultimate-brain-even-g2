// @vitest-environment jsdom
/**
 * Component-level coverage for App.tsx's own wiring — the Settings/Status screen switch, the
 * header's Back/Settings buttons, and the 10-tap debug log unlock (debugLogUnlock.ts is already
 * pinned exactly by debugLogUnlock.test.ts; this asserts App wires it to the version button and
 * survives navigation, which that pure-logic suite can't).
 *
 * framer-motion (PageStack.tsx) is mocked to render its children with no animation: this file
 * cares which screen's content is present, not how it transitions in — an exit animation would
 * otherwise keep the outgoing screen mounted for ~320ms after every navigation.
 *
 * `isDebugLogVisible`'s second argument defaults to `import.meta.env.DEV`, which is `true` under
 * vitest — every unlock test here stubs it to `false` first, or the console would always be
 * visible regardless of taps.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchDatabases: vi.fn() }));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: { children?: ReactNode }) => {
          // Drop framer-motion-only props (custom/variants/initial/animate/exit/transition) —
          // passing them through to a DOM div would warn about unknown attributes.
          void rest;
          return <div>{children}</div>;
        },
    },
  ),
  useReducedMotion: () => true,
}));

vi.mock('../../voice-runtime', () => ({
  refreshVoiceStatus: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../voice-model', () => ({
  hasModel: vi.fn().mockResolvedValue(false),
  downloadModel: vi.fn(),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  MODEL_SIZE_MB: 41,
}));
vi.mock('../../stt/soniox', () => ({ testSonioxKey: vi.fn().mockResolvedValue('valid') }));
vi.mock('../../web/services/databases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/services/databases')>();
  return { ...actual, fetchDatabases: mocks.fetchDatabases };
});

import { App } from '../../web/App';
import { AppProviders } from '../../web/providers';
import { cancelSettings, onSettingsClick, promptForConfig } from '../../web/providers/uiController';
import { fittingDatabases } from './harness/dbFixtures';

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

async function tapVersion(user: ReturnType<typeof userEvent.setup>, times: number): Promise<void> {
  const button = screen.getByRole('button', { name: /^v/ });
  for (let i = 0; i < times; i++) {
    await user.click(button);
  }
}

beforeEach(() => {
  vi.stubEnv('DEV', false);
  mocks.fetchDatabases.mockReset().mockResolvedValue([]);
  // Mirrors boot.ts's real wiring (`onSettingsClick(() => reconfigure(...))`) — the gear
  // button's onClick only calls `triggerSettings()`, which is a no-op until something has
  // registered a handler via `onSettingsClick`. Tests that need `cancellable: true` (Back
  // button visible) call `promptForConfig` directly instead of going through the gear, the
  // same way boot.ts's `reconfigure()` does when re-opening with an existing config.
  onSettingsClick(() => promptForConfig(null, false));
});

afterEach(() => {
  cleanup();
  cancelSettings();
  vi.unstubAllEnvs();
});

describe('App — screen switch', () => {
  it('shows the status screen by default, with a Settings button and no Back button', () => {
    renderApp();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('tapping Settings opens the Settings screen', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByLabelText('Integration Token')).toBeInTheDocument();
  });

  it('the header title switches to "Notion Settings"', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Notion Settings')).toBeInTheDocument();
  });

  it('shows a Back button only when the prompt is cancellable', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    // triggerSettings() (production's own gear button) opens with cancellable: false —
    // see uiController.ts's onSettingsClick wiring in boot.ts.
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('Back cancels the prompt and returns to the status screen', async () => {
    renderApp();
    promptForConfig(null, true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('saving from the form closes Settings and returns to the status screen', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.type(screen.getByLabelText('Integration Token'), 'ntn_abcdefghijklmnop');
    await waitFor(() => expect(screen.getByText('Tasks Database')).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Integration Token')).not.toBeInTheDocument();
  });
});

describe('App — debug log unlock', () => {
  it('the debug log stays hidden for the first nine version taps', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await tapVersion(user, 9);
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('the tenth tap reveals the debug log', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await tapVersion(user, 10);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('the unlock survives leaving and re-entering Settings', async () => {
    const user = userEvent.setup();
    renderApp();
    promptForConfig(null, true);
    await screen.findByLabelText('Integration Token');
    await tapVersion(user, 10);
    expect(screen.getByRole('log')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('the log console is visible in dev without any taps', async () => {
    vi.stubEnv('DEV', true);
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('log')).toBeInTheDocument();
  });
});
