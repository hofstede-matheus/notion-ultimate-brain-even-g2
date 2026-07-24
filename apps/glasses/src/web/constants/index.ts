/**
 * Constants for the companion-app webview shell (status text, connect
 * button, on-screen log overlay). Keep "magic numbers" used in more than
 * one place — or whose meaning benefits from a name — here rather than
 * scattering them across modules.
 */

export type Level = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * console method names that get mirrored into the trace log (see
 * ../utils/logger.ts). Order is irrelevant; the buffer only cares that
 * every level is patched.
 */
export const LOG_LEVELS: readonly Level[] = ['log', 'info', 'warn', 'error', 'debug'];

/** Bytes of a request body included in each `[API →]` log line. */
export const BODY_PREVIEW_BYTES = 200;
