/**
 * The Even Hub simulator's own devtools harness logs a heartbeat-style
 * message roughly every 2 seconds regardless of what the app does — real
 * captures have shown it drowning out 40+ of ~75 buffered lines in under two
 * minutes of idle simulator time. Simulator-only, zero diagnostic value —
 * drop it before it reaches the trace buffer, same treatment as the
 * audioPcm frames in ./audioFilter.ts.
 */
export function isSimulatorNoiseLog(args: unknown[]): boolean {
  for (const a of args) {
    if (typeof a === 'string' && a.includes('intercepted: evenAppMessage')) return true;
  }
  return false;
}
