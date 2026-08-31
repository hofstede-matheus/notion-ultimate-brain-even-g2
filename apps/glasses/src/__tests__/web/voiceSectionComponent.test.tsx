// @vitest-environment jsdom
/**
 * Component-level coverage for VoiceSection.tsx — the mode selector, the on-device model
 * download/remove state machine, and the cloud Soniox key/language-hints controls.
 *
 * Named `voiceSectionComponent` (not `voiceSection`, which already covers the pure logic in
 * ../../web/screens/SettingsForm/voiceSection.ts: downloadPercent, formatProgress,
 * isPlausibleApiKey, voiceConfigFromDraft, languageHintsError). This file only asserts what
 * rendering and driving the real component adds: the model-state transitions, which button
 * shows in which state, and that user input actually reaches the draft callbacks.
 *
 * VoiceSection owns its mode/apiKey/hints as *props*, not state — a small local wrapper below
 * plays the parent's role (SettingsForm, in production) so a mode/key change made through the
 * UI is reflected back into what's rendered, the same round trip SettingsForm provides.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasModel: vi.fn(),
  downloadModel: vi.fn(),
  deleteModel: vi.fn(),
  testSonioxKey: vi.fn(),
  refreshVoiceStatus: vi.fn(),
}));

vi.mock('../../voice-model', () => ({
  hasModel: mocks.hasModel,
  downloadModel: mocks.downloadModel,
  deleteModel: mocks.deleteModel,
  MODEL_SIZE_MB: 41,
}));
vi.mock('../../stt/soniox', () => ({ testSonioxKey: mocks.testSonioxKey }));
vi.mock('../../voice-runtime', () => ({ refreshVoiceStatus: mocks.refreshVoiceStatus }));

import type { VoiceMode } from '../../voice-config';
import { VoiceSection } from '../../web/screens/SettingsForm/components/VoiceSection';
import { selectTrigger } from './harness/settings';

/** Stands in for SettingsForm: owns the draft state VoiceSection is controlled by. */
function VoiceSectionHarness(props: { initialMode?: VoiceMode }) {
  const [mode, setMode] = useState<VoiceMode>(props.initialMode ?? 'off');
  const [apiKey, setApiKey] = useState('');
  const [languageHints, setLanguageHints] = useState('');
  const [languageHintsStrict, setLanguageHintsStrict] = useState(false);
  return (
    <VoiceSection
      mode={mode}
      apiKey={apiKey}
      languageHints={languageHints}
      languageHintsStrict={languageHintsStrict}
      onModeChange={setMode}
      onApiKeyChange={setApiKey}
      onLanguageHintsChange={setLanguageHints}
      onLanguageHintsStrictChange={setLanguageHintsStrict}
    />
  );
}

function renderVoiceSection(initialMode?: VoiceMode) {
  return render(<VoiceSectionHarness initialMode={initialMode} />);
}

/** A deferred promise, for driving downloadModel's progress/cancel/failure paths by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.hasModel.mockReset().mockResolvedValue(false);
  mocks.downloadModel.mockReset();
  mocks.deleteModel.mockReset().mockResolvedValue(undefined);
  mocks.testSonioxKey.mockReset();
  mocks.refreshVoiceStatus.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('VoiceSection — modes', () => {
  it('shows the disabled copy in off mode', () => {
    renderVoiceSection('off');
    expect(
      screen.getByText('Add Task by voice is disabled. Pick a mode to enable it.'),
    ).toBeInTheDocument();
  });

  it('changing the mode dropdown calls onModeChange and re-renders the new mode', async () => {
    const user = userEvent.setup();
    renderVoiceSection('off');
    await user.click(selectTrigger('Voice input'));
    await user.click(screen.getByRole('button', { name: 'On-device' }));
    expect(selectTrigger('Voice input')).toHaveTextContent('On-device');
  });

  it('shows the on-device explanation and the 41 MB size', async () => {
    renderVoiceSection('on-device');
    await waitFor(() => expect(mocks.hasModel).toHaveBeenCalled());
    expect(screen.getByText(/Needs a one-time 41 MB download/)).toBeInTheDocument();
  });

  it('shows the cloud privacy warning and the pricing line', () => {
    renderVoiceSection('cloud');
    expect(screen.getByText('Audio is sent to Soniox for transcription.')).toBeInTheDocument();
    expect(screen.getByText(/\$0\.12 per hour/)).toBeInTheDocument();
  });
});

describe('VoiceSection — on-device model state machine', () => {
  it('shows "Checking…" until the model probe resolves', async () => {
    const probe = deferred<boolean>();
    mocks.hasModel.mockReturnValue(probe.promise);
    renderVoiceSection('on-device');
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    probe.resolve(false);
    await waitFor(() => expect(screen.queryByText('Checking…')).not.toBeInTheDocument());
  });

  it('offers "Download (41 MB)" when no model is stored', async () => {
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    expect(await screen.findByRole('button', { name: 'Download (41 MB)' })).toBeInTheDocument();
  });

  it('shows "Downloaded ✓" and Remove when a model is present', async () => {
    mocks.hasModel.mockResolvedValue(true);
    renderVoiceSection('on-device');
    expect(await screen.findByText('Downloaded ✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('a download in progress renders the progress bar and the received/total figure', async () => {
    const dl = deferred<void>();
    mocks.downloadModel.mockImplementation((onProgress: (r: number, t: number) => void) => {
      onProgress(24_000_000, 41_000_000);
      return dl.promise;
    });
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    expect(await screen.findByText('24 MB / 41 MB')).toBeInTheDocument();
    dl.resolve();
  });

  it('shows "Downloading…" while the total size is unknown', async () => {
    const dl = deferred<void>();
    mocks.downloadModel.mockImplementation((onProgress: (r: number, t: number) => void) => {
      onProgress(1_000_000, 0);
      return dl.promise;
    });
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    expect(await screen.findByText('Downloading…')).toBeInTheDocument();
    dl.resolve();
  });

  it('a completed download flips to Downloaded and refreshes the voice status', async () => {
    const dl = deferred<void>();
    mocks.downloadModel.mockReturnValue(dl.promise);
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    dl.resolve();
    expect(await screen.findByText('Downloaded ✓')).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshVoiceStatus).toHaveBeenCalledTimes(1));
  });

  it('Cancel aborts the download and returns to the un-downloaded state with no error shown', async () => {
    const dl = deferred<void>();
    mocks.downloadModel.mockImplementation((_onProgress: unknown, signal?: AbortSignal) => {
      signal?.addEventListener('abort', () => dl.reject(new DOMException('aborted', 'AbortError')));
      return dl.promise;
    });
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Download (41 MB)' })).toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });

  it('a failed download shows the error message and a "Try again" button', async () => {
    mocks.downloadModel.mockRejectedValue(new Error('Download failed with status 500'));
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    expect(await screen.findByText('Download failed with status 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('"Try again" restarts the download', async () => {
    mocks.downloadModel.mockRejectedValueOnce(new Error('boom'));
    const dl = deferred<void>();
    mocks.downloadModel.mockReturnValueOnce(dl.promise);
    const user = userEvent.setup();
    mocks.hasModel.mockResolvedValue(false);
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Download (41 MB)' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(mocks.downloadModel).toHaveBeenCalledTimes(2);
    dl.resolve();
  });

  it('Remove deletes the model and returns to the un-downloaded state', async () => {
    mocks.hasModel.mockResolvedValue(true);
    const user = userEvent.setup();
    renderVoiceSection('on-device');
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(mocks.deleteModel).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Download (41 MB)' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshVoiceStatus).toHaveBeenCalledTimes(1));
  });

  it('the probed model state survives switching modes away and back', async () => {
    mocks.hasModel.mockResolvedValue(true);
    const user = userEvent.setup();
    renderVoiceSection('on-device');
    await screen.findByText('Downloaded ✓');

    await user.click(selectTrigger('Voice input'));
    await user.click(screen.getByRole('button', { name: 'Cloud (Soniox)' }));
    expect(screen.queryByText('Downloaded ✓')).not.toBeInTheDocument();

    await user.click(selectTrigger('Voice input'));
    await user.click(screen.getByRole('button', { name: 'On-device' }));
    expect(screen.getByText('Downloaded ✓')).toBeInTheDocument();
  });
});

describe('VoiceSection — Soniox key', () => {
  it('renders the key field as a password input', () => {
    renderVoiceSection('cloud');
    expect(screen.getByLabelText('Soniox API key')).toHaveAttribute('type', 'password');
  });

  it('marks a too-short key invalid and a plausible one valid', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    const input = screen.getByLabelText('Soniox API key');
    await user.type(input, 'short');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.type(input, '-but-now-plausible-enough');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('"Test key" is disabled until the key is plausible', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    expect(screen.getByRole('button', { name: 'Test key' })).toBeDisabled();
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    expect(screen.getByRole('button', { name: 'Test key' })).toBeEnabled();
  });

  it('"Test key" is disabled while a check is in flight', async () => {
    const check = deferred<'valid'>();
    mocks.testSonioxKey.mockReturnValue(check.promise);
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(screen.getByRole('button', { name: 'Test key' })).toBeDisabled();
    check.resolve('valid');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test key' })).toBeEnabled());
  });

  it('shows "Testing…" during the check', async () => {
    const check = deferred<'valid'>();
    mocks.testSonioxKey.mockReturnValue(check.promise);
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(screen.getByText('Testing…')).toBeInTheDocument();
    check.resolve('valid');
    await waitFor(() => expect(screen.queryByText('Testing…')).not.toBeInTheDocument());
  });

  it('shows "Key works ✓" for a valid key', async () => {
    mocks.testSonioxKey.mockResolvedValue('valid');
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText('Key works ✓')).toBeInTheDocument();
  });

  it('shows "Key rejected by Soniox" for an invalid key', async () => {
    mocks.testSonioxKey.mockResolvedValue('invalid');
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText('Key rejected by Soniox')).toBeInTheDocument();
  });

  it('shows "Couldn\'t reach Soniox" when the check cannot connect', async () => {
    mocks.testSonioxKey.mockResolvedValue('unreachable');
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByLabelText('Soniox API key'), 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText("Couldn't reach Soniox")).toBeInTheDocument();
  });

  it('editing the key clears the previous verdict', async () => {
    mocks.testSonioxKey.mockResolvedValue('valid');
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    const input = screen.getByLabelText('Soniox API key');
    await user.type(input, 'a-plausible-looking-api-key');
    await user.click(screen.getByRole('button', { name: 'Test key' }));
    await screen.findByText('Key works ✓');

    await user.type(input, 'x');
    expect(screen.queryByText('Key works ✓')).not.toBeInTheDocument();
  });
});

describe('VoiceSection — language hints', () => {
  it('accepts comma-separated codes with no complaint', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByPlaceholderText('en, nl'), 'en, nl');
    expect(screen.getByPlaceholderText('en, nl')).not.toHaveAttribute('aria-invalid');
  });

  it('flags an unknown code with the "Unknown code" message and marks the field invalid', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    const input = screen.getByPlaceholderText('en, nl');
    await user.type(input, 'xx');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Unknown code: xx/)).toBeInTheDocument();
  });

  it('does not flag an empty hints field', () => {
    renderVoiceSection('cloud');
    expect(screen.getByPlaceholderText('en, nl')).not.toHaveAttribute('aria-invalid');
  });

  it('the strict checkbox reflects and reports its state', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    const checkbox = screen.getByLabelText('Restrict to these languages');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('hint edits propagate through onLanguageHintsChange', async () => {
    const user = userEvent.setup();
    renderVoiceSection('cloud');
    await user.type(screen.getByPlaceholderText('en, nl'), 'en');
    // Propagation is proven by the controlled input reflecting the typed value at all — an
    // uncontrolled/disconnected onChange would leave the field empty or reset each keystroke.
    expect(screen.getByPlaceholderText('en, nl')).toHaveValue('en');
  });
});
