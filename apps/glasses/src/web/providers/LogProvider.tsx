import { createContext, type ReactNode, useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '../../logging/sink';
import type { LogRecord } from '../../logging/types';

export const LogContext = createContext<LogRecord[] | null>(null);

/** Thin React adapter over ../../logging/sink — see ../screens/SettingsForm/components/LogConsole. */
export function LogProvider({ children }: { children: ReactNode }) {
  const logEntries = useSyncExternalStore(subscribe, getSnapshot);
  return <LogContext.Provider value={logEntries}>{children}</LogContext.Provider>;
}
