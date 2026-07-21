/**
 * Constants for the companion-app webview shell (status text, connect
 * button, on-screen log overlay). Keep "magic numbers" used in more than
 * one place — or whose meaning benefits from a name — here rather than
 * scattering them across modules.
 */

export type Level = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * console method names that get mirrored into the on-screen log overlay.
 * Order is irrelevant; the overlay only cares that every level is patched.
 */
export const LOG_LEVELS: readonly Level[] = ['log', 'info', 'warn', 'error', 'debug'];

/** Max on-screen log lines before the buffer (and the matching DOM) is pruned FIFO. */
export const MAX_LOG_LINES = 500;

/** Bytes of a request body included in each `[API →]` log line. */
export const BODY_PREVIEW_BYTES = 200;
