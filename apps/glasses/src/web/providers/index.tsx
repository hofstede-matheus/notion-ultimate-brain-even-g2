import type { ReactNode } from 'react';
import { LogProvider } from './LogProvider';
import { UiStateProvider } from './UiStateProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiStateProvider>
      <LogProvider>{children}</LogProvider>
    </UiStateProvider>
  );
}
