import { createContext, type ReactNode, useSyncExternalStore } from 'react';
import { type Level, MAX_LOG_LINES } from '../constants';
import { forwardToTerminal } from '../services/logs';

/** One rendered log line, as subscribed to by ../screens/SettingsForm/components/LogConsole. */
export interface LogEntry {
  level: Level;
  line: string;
  /** True for request/response lines emitted by installFetchLogger. */
  api: boolean;
}

let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

/** Subscribe to log updates (React's `useSyncExternalStore`). */
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current log snapshot. A new array reference is produced on every append
 * (see appendLine) so `useSyncExternalStore` reliably detects changes —
 * mutating one shared array in place would leave the reference unchanged
 * and React would never re-render.
 */
export function getLogEntries(): LogEntry[] {
  return entries;
}

/** Invoked by ../utils/logger's console/fetch patches. */
export function appendLine(level: Level, line: string, api = false): void {
  const next =
    entries.length >= MAX_LOG_LINES
      ? entries.slice(entries.length - MAX_LOG_LINES + 1)
      : entries.slice();
  next.push({ level, line, api });
  entries = next;
  for (const listener of listeners) listener();

  forwardToTerminal(level, line);
}

export const LogContext = createContext<LogEntry[] | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const logEntries = useSyncExternalStore(subscribeLog, getLogEntries);
  return <LogContext.Provider value={logEntries}>{children}</LogContext.Provider>;
}
