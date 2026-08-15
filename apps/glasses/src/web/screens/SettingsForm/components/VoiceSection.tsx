import { Button } from 'even-toolkit/web/button';
import { Input } from 'even-toolkit/web/input';
import { Progress } from 'even-toolkit/web/progress';
import { SegmentedControl } from 'even-toolkit/web/segmented-control';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trace } from '../../../../logging/trace';
import { type SonioxKeyCheck, testSonioxKey } from '../../../../stt/soniox';
import {
  loadVoiceConfig,
  saveVoiceConfig,
  type VoiceConfig,
  type VoiceMode,
} from '../../../../voice-config';
import { deleteModel, downloadModel, hasModel, MODEL_SIZE_MB } from '../../../../voice-model';
import { refreshVoiceStatus } from '../../../../voice-runtime';
import {
  downloadPercent,
  formatProgress,
  isPlausibleApiKey,
  type ModelState,
  VOICE_MODES,
} from '../voiceSection';

type KeyCheckState = 'idle' | 'checking' | SonioxKeyCheck;

const KEY_CHECK_LABEL: Record<KeyCheckState, string> = {
  idle: '',
  checking: 'Testing…',
  valid: 'Key works ✓',
  invalid: 'Key rejected by Soniox',
  // Deliberately not "key is bad": the key may be fine and the connection not.
  unreachable: "Couldn't reach Soniox",
};

const KEY_CHECK_TONE: Record<KeyCheckState, string> = {
  idle: 'text-text-dim',
  checking: 'text-text-dim',
  valid: 'text-positive',
  invalid: 'text-negative',
  unreachable: 'text-accent-warning',
};

/**
 * Picks the speech backend for Add Task, and manages whichever one is chosen:
 * the one-time model download for on-device, or the API key for cloud.
 *
 * Lives outside the settings <form> and saves on its own, rather than waiting
 * for the form's Save — a download is long-running and a half-finished one
 * shouldn't be tied to submitting Notion credentials.
 */
export function VoiceSection() {
  const [mode, setMode] = useState<VoiceMode>('off');
  const [apiKey, setApiKey] = useState('');
  const [modelState, setModelState] = useState<ModelState>('checking');
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [keyCheck, setKeyCheck] = useState<KeyCheckState>('idle');
  const abortRef = useRef<AbortController | null>(null);

  // Load the stored config once, then check whether the model is present.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cfg = await loadVoiceConfig();
      if (cancelled) return;
      setMode(cfg.mode);
      setApiKey(cfg.sonioxApiKey ?? '');
      const present = await hasModel();
      if (cancelled) return;
      setModelState(present ? 'ready' : 'absent');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort an in-flight download if the section unmounts mid-transfer.
  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = useCallback(async (cfg: VoiceConfig) => {
    await saveVoiceConfig(cfg);
    // Take effect immediately — no app restart to start dictating.
    await refreshVoiceStatus(cfg);
  }, []);

  function handleModeChange(next: string): void {
    const nextMode = next as VoiceMode;
    setMode(nextMode);
    setError(null);
    void persist({ mode: nextMode, ...(apiKey ? { sonioxApiKey: apiKey } : {}) });
  }

  function handleKeyChange(next: string): void {
    setApiKey(next);
    setError(null);
    setKeyCheck('idle'); // a previous verdict says nothing about a different key
    if (isPlausibleApiKey(next)) void persist({ mode: 'cloud', sonioxApiKey: next.trim() });
  }

  async function handleTestKey(): Promise<void> {
    setKeyCheck('checking');
    setKeyCheck(await testSonioxKey(apiKey.trim()));
  }

  async function handleDownload(): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setModelState('downloading');
    setError(null);
    setReceived(0);
    setTotal(0);
    try {
      await downloadModel((got, size) => {
        setReceived(got);
        setTotal(size);
      }, controller.signal);
      setModelState('ready');
      await persist({ mode: 'on-device' });
    } catch (e) {
      if (controller.signal.aborted) {
        setModelState('absent');
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      trace.error('VOICE', `model download failed: ${msg}`);
      setError(msg);
      setModelState('failed');
    } finally {
      abortRef.current = null;
    }
  }

  async function handleRemove(): Promise<void> {
    await deleteModel();
    setModelState('absent');
    await refreshVoiceStatus({ mode });
  }

  const percent = downloadPercent(received, total);

  return (
    <div className="mt-6">
      <h2 className="text-[13px] tracking-[-0.13px] text-text-dim mb-1">Voice input</h2>

      <SegmentedControl
        options={VOICE_MODES}
        value={mode}
        onValueChange={handleModeChange}
        size="small"
      />

      {mode === 'off' && (
        <p className="text-[12px] text-text-dim mt-2">
          Add Task by voice is disabled. Pick a mode to enable it.
        </p>
      )}

      {mode === 'on-device' && (
        <div className="mt-2">
          <p className="text-[12px] text-text-dim">
            Speech is recognised on your phone. Nothing is sent anywhere, and it works without a
            connection. English only. Needs a one-time {MODEL_SIZE_MB} MB download.
          </p>

          {modelState === 'checking' && <p className="text-[13px] text-text-dim mt-2">Checking…</p>}

          {(modelState === 'absent' || modelState === 'failed') && (
            <div className="mt-2">
              <Button type="button" variant="highlight" onClick={() => void handleDownload()}>
                {modelState === 'failed' ? 'Try again' : `Download (${MODEL_SIZE_MB} MB)`}
              </Button>
              <p className="text-[12px] text-text-dim mt-1">Best done on Wi-Fi.</p>
              {error && <p className="text-[12px] text-negative mt-1">{error}</p>}
            </div>
          )}

          {modelState === 'downloading' && (
            <div className="mt-2">
              <Progress value={percent ?? 0} />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[12px] text-text-dim">
                  {percent === null ? 'Downloading…' : formatProgress(received, total)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => abortRef.current?.abort()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {modelState === 'ready' && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[13px] text-positive">Downloaded ✓</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleRemove()}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === 'cloud' && (
        <div className="mt-2">
          {/* Stated up front, not behind a link: this is the one mode where
              what you say leaves the device. */}
          <p className="text-[12px] text-accent-warning">
            Audio is sent to Soniox for transcription.
          </p>
          <p className="text-[12px] text-text-dim mt-1">
            No download, and it understands 60+ languages. You pay Soniox directly — about $0.12 per
            hour of recording, so well under a cent per task.
          </p>
          <label
            htmlFor="settings-soniox-key"
            className="text-[13px] tracking-[-0.13px] text-text-dim mb-1 block mt-2"
          >
            Soniox API key
          </label>
          <Input
            id="settings-soniox-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="Paste your API key"
            error={apiKey.length > 0 && !isPlausibleApiKey(apiKey)}
          />
          <p className="text-[12px] text-text-dim mt-1">
            Create one at console.soniox.com. It is stored on this device only.
          </p>

          <div className="flex items-center justify-between mt-2">
            <span className={`text-[12px] ${KEY_CHECK_TONE[keyCheck]}`}>
              {KEY_CHECK_LABEL[keyCheck]}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={keyCheck === 'checking' || !isPlausibleApiKey(apiKey)}
              onClick={() => void handleTestKey()}
            >
              Test key
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
