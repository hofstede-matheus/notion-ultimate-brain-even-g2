/**
 * Shared types for the companion-app webview shell (status text, connect
 * button, on-screen log overlay). Kept separate from `./constants` so the
 * type graph (consumed by virtually every module) doesn't pull in value
 * definitions.
 */

export type Level = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** One rendered log line, as subscribed to by ./components/LogConsole. */
export interface LogEntry {
  level: Level;
  line: string;
  /** True for request/response lines emitted by installFetchLogger. */
  api: boolean;
}
