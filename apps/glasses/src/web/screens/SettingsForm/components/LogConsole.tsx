import { Card } from 'even-toolkit/web/card';
import { useEffect, useRef } from 'react';
import { useLogEntries } from '../../../hooks/useLogEntries';
import type { LogEntry } from '../../../providers/LogProvider';

/** Level → text color token. Warn/error win over the generic "api" accent. */
function colorFor(entry: LogEntry): string {
  if (entry.level === 'error') return 'text-negative';
  if (entry.level === 'warn') return 'text-accent-warning';
  if (entry.api) return 'text-positive';
  if (entry.level === 'debug') return 'text-text-highlight/50';
  return 'text-text-highlight/90';
}

export function LogConsole() {
  const entries = useLogEntries();
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs on every new log entry to auto-scroll, though the effect body doesn't read `entries` directly.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div className="mt-6 mb-4">
      <h2 className="text-[13px] tracking-[-0.13px] text-text-dim mb-1">Debug log</h2>
      <Card
        padding="sm"
        ref={scrollRef}
        role="log"
        aria-label="App log"
        className="bg-accent h-56 overflow-y-auto"
      >
        <pre className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-[11px] leading-[1.4]">
          {entries.map((entry, i) => (
            // Index keys are fine here: entries are static, append-only log
            // lines with no natural id, and the buffer is FIFO-pruned at 500.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <div key={i} className={colorFor(entry)}>
              {entry.line}
            </div>
          ))}
        </pre>
      </Card>
    </div>
  );
}
