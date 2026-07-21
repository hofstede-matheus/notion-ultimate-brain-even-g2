import { useContext } from 'react';
import { LogContext } from '../providers/LogProvider';

export function useLogEntries() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLogEntries must be used within LogProvider');
  return ctx;
}
