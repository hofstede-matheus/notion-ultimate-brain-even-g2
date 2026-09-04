// @vitest-environment jsdom
/**
 * Component-level coverage for LogConsole.tsx — the debug log console behind Settings' 10-tap
 * unlock. Drives the real logging/sink.ts buffer (via append/seedPreviousSession/clear) rather
 * than faking LogRecord shapes by hand, so entries carry a real pre-rendered `line` the same way
 * production trace() calls produce them.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ copyToClipboard: vi.fn() }));

vi.mock('../../logging/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../logging/export')>();
  return { ...actual, copyToClipboard: mocks.copyToClipboard };
});

import { append, clear, seedPreviousSession } from '../../logging/sink';
import { LogProvider } from '../../web/providers/LogProvider';
import { LogConsole } from '../../web/screens/SettingsForm/components/LogConsole';

function renderLogConsole() {
  return render(
    <LogProvider>
      <LogConsole />
    </LogProvider>,
  );
}

beforeEach(() => {
  clear();
  mocks.copyToClipboard.mockReset();
});

afterEach(() => {
  cleanup();
  clear();
});

describe('LogConsole', () => {
  it('renders the entry count in the heading', () => {
    append('info', 'NAV', 'first');
    append('info', 'NAV', 'second');
    renderLogConsole();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders every entry\'s line inside the role="log" region', () => {
    append('info', 'NAV', 'went to today');
    append('warn', 'EVT', 'scroll throttled');
    renderLogConsole();
    const log = screen.getByRole('log', { name: 'App log' });
    expect(log).toHaveTextContent('went to today');
    expect(log).toHaveTextContent('scroll throttled');
  });

  it('colours error, warn, API and debug entries distinctly', () => {
    append('error', 'API', 'boom');
    append('warn', 'EVT', 'careful');
    append('info', 'API', 'ok call');
    append('debug', 'CACHE', 'quiet');
    const { container } = renderLogConsole();
    const lines = [...container.querySelectorAll('pre > div > div:last-child')] as HTMLElement[];
    expect(lines.map((el) => el.className)).toEqual([
      'text-negative',
      'text-accent-warning',
      'text-positive',
      'text-text-highlight/50',
    ]);
  });

  it('draws the "previous session" divider at the first live entry after restored ones', () => {
    seedPreviousSession([
      { seq: 1, t: 1, level: 'info', cat: 'BOOT', msg: 'old', line: 'old boot line' },
    ]);
    append('info', 'NAV', 'new session line');
    renderLogConsole();
    expect(screen.getByText('── previous session ──')).toBeInTheDocument();
  });

  it('draws no divider when every entry is from the same session', () => {
    append('info', 'NAV', 'a');
    append('info', 'NAV', 'b');
    renderLogConsole();
    expect(screen.queryByText('── previous session ──')).not.toBeInTheDocument();
  });

  it('Copy writes the built log text and shows "Copied ✓"', async () => {
    mocks.copyToClipboard.mockResolvedValue(true);
    append('info', 'NAV', 'something to copy');
    const user = userEvent.setup();
    renderLogConsole();
    await user.click(screen.getByRole('button', { name: 'Copy log' }));
    expect(await screen.findByText('Copied ✓')).toBeInTheDocument();
    expect(mocks.copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('something to copy'),
    );
  });

  it('shows "Copy failed" when the clipboard write fails', async () => {
    mocks.copyToClipboard.mockResolvedValue(false);
    const user = userEvent.setup();
    renderLogConsole();
    await user.click(screen.getByRole('button', { name: 'Copy log' }));
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
  });

  it('the copy label resets to "Copy log" after 1.5s', async () => {
    mocks.copyToClipboard.mockResolvedValue(true);
    const user = userEvent.setup();
    renderLogConsole();
    await user.click(screen.getByRole('button', { name: 'Copy log' }));
    await screen.findByText('Copied ✓');
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Copy log' })).toBeInTheDocument(),
      {
        timeout: 2500,
      },
    );
  });

  it('Clear empties the sink', async () => {
    append('info', 'NAV', 'to be cleared');
    const user = userEvent.setup();
    renderLogConsole();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('(0)')).toBeInTheDocument();
    expect(screen.queryByText('to be cleared')).not.toBeInTheDocument();
  });

  it('throws when rendered outside LogProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<LogConsole />)).toThrow('useLogEntries must be used within LogProvider');
    consoleError.mockRestore();
  });
});
