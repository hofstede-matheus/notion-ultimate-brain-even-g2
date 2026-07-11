/**
 * Shared types for the companion-app webview shell (status text, connect
 * button, on-screen log overlay). Kept separate from `./constants` so the
 * type graph (consumed by virtually every module) doesn't pull in value
 * definitions.
 */

export type Level = 'log' | 'info' | 'warn' | 'error' | 'debug'