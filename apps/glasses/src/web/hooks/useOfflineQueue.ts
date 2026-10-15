import { useSyncExternalStore } from 'react';
import { getQueue, type QueuedTask, subscribeQueue } from '../../offline-queue';

/**
 * Live view of the offline task queue. Thin adapter over ../../offline-queue's
 * external store, mirroring ../providers/LogProvider's shape — no Context
 * wrapper here, since there is a single consumer.
 */
export function useOfflineQueue(): QueuedTask[] {
  return useSyncExternalStore(subscribeQueue, getQueue, getQueue);
}
