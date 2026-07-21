import { createContext, type ReactNode, useSyncExternalStore } from 'react';
import { getState, subscribe, type UiState } from './uiController';

export const UiStateContext = createContext<UiState | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getState);
  return <UiStateContext.Provider value={state}>{children}</UiStateContext.Provider>;
}
