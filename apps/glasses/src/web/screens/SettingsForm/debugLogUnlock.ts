/** How many taps on the version label reveal the debug log (Tallinja parity). */
export const LOG_UNLOCK_TAPS = 10;

/** Advance the tap counter; returns the new count and whether the log should show. */
export function nextUnlockTap(count: number): { count: number; unlocked: boolean } {
  const next = count + 1;
  return { count: next, unlocked: next >= LOG_UNLOCK_TAPS };
}

/** Whether the debug log panel should mount — always in `vite dev`, otherwise session unlock. */
export function isDebugLogVisible(unlocked: boolean, isDev = import.meta.env.DEV): boolean {
  return isDev || unlocked;
}
