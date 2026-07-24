import { Button } from 'even-toolkit/web/button';
import { Card } from 'even-toolkit/web/card';
import { useEffect, useRef, useState } from 'react';
import { buildLogText, copyToClipboard } from '../../../../logging/export';
import { clearPersisted } from '../../../../logging/persist';
import { clear as clearSink } from '../../../../logging/sink';
import type { LogRecord } from '../../../../logging/types';
import { useLogEntries } from '../../../hooks/useLogEntries';

/** Level/category → text color token. Warn/error win over the generic "API" accent. */
function colorFor(entry: LogRecord): string {
  if (entry.level === 'error') return 'text-negative';
  if (entry.level === 'warn') return 'text-accent-warning';
  if (entry.cat === 'API') return 'text-positive';
  if (entry.level === 'debug') return 'text-text-highlight/50';
  return 'text-text-highlight/90';
}

type CopyState = 'idle' | 'copied' | 'failed';

export function LogConsole() {
  const entries = useLogEntries();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs on every new log entry to auto-scroll, though the effect body doesn't read `entries` directly.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 1500);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(buildLogText());
    setCopyState(ok ? 'copied' : 'failed');
  }

  function handleClear(): void {
    clearSink();
    void clearPersisted();
    setCopyState('idle');
  }

  const copyLabel =
    copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy log';

  return (
    <div className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[13px] tracking-[-0.13px] text-text-dim">
          Debug log <span className="text-text-dim/60">({entries.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
            {copyLabel}
          </Button>
        </div>
      </div>
      <Card
        padding="sm"
        ref={scrollRef}
        role="log"
        aria-label="App log"
        className="bg-accent h-72 overflow-y-auto"
      >
        <pre className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-[11px] leading-[1.4]">
          {entries.map((entry, i) => {
            const prev = entries[i - 1];
            const showDivider = prev?.previousSession === true && !entry.previousSession;
            return (
              // Index keys are fine here: entries are static, append-only log
              // lines with no natural id, and the buffer is FIFO-pruned at
              // LOG_BUFFER_SIZE.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <div key={i}>
                {showDivider && (
                  <div className="text-text-dim/60 select-none">── previous session ──</div>
                )}
                <div className={colorFor(entry)}>{entry.line}</div>
              </div>
            );
          })}
        </pre>
      </Card>
    </div>
  );
}
