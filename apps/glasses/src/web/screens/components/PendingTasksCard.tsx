import { Button } from 'even-toolkit/web/button';
import { Card } from 'even-toolkit/web/card';
import { Divider } from 'even-toolkit/web/divider';
import { useState } from 'react';
import { clearQueue, discardQueued, drainQueue } from '../../../offline-queue';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { canSync, describeEntry, summarize, type Tone } from '../pendingTasks';

const TONE_CLASS: Record<Tone, string> = {
  dim: 'text-text-dim',
  active: 'text-text',
  negative: 'text-negative',
};

/**
 * Tasks dictated on the glasses that could not reach Notion yet. Renders
 * nothing when the queue is empty, so the Status screen is unchanged in the
 * normal case. See ../../../offline-queue.ts.
 */
export function PendingTasksCard() {
  const entries = useOfflineQueue();
  const [syncing, setSyncing] = useState(false);

  if (entries.length === 0) return null;

  const onSync = async () => {
    setSyncing(true);
    try {
      await drainQueue('phone sync button');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="mt-4 p-3">
      <p className="text-[13px] tracking-[-0.13px] text-text-dim mb-2">{summarize(entries)}</p>
      <Divider />
      <ul className="my-2 flex flex-col gap-2">
        {entries.map((entry) => {
          const { label, tone } = describeEntry(entry);
          return (
            <li key={entry.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] break-words">{entry.name}</p>
                <p className={`text-[13px] tracking-[-0.13px] ${TONE_CLASS[tone]}`}>{label}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void discardQueued(entry.id)}
              >
                Discard
              </Button>
            </li>
          );
        })}
      </ul>
      <Divider />
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="highlight"
          size="sm"
          disabled={syncing || !canSync(entries)}
          onClick={() => void onSync()}
        >
          {syncing ? 'Syncing...' : 'Sync now'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => void clearQueue()}>
          Clear
        </Button>
      </div>
    </Card>
  );
}
