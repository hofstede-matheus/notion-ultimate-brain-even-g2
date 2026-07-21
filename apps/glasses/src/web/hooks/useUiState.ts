import { useContext } from 'react';
import { UiStateContext } from '../providers/UiStateProvider';

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  return ctx;
}
