/**
 * Constants for the glasses runtime — display geometry, native-list caps,
 * container IDs/names, scroll throttle, spinner frames, and the Vosk model
 * URL. Centralising these here keeps the per-feature modules focused on
 * behaviour and gives a single place to tune values like list item caps
 * or display dimensions.
 */

// ---------------------------------------------------------------------------
// Native G2 list widget caps (firmware rejects rebuilds that exceed these)
// ---------------------------------------------------------------------------

/** G2 native list widget item cap. */
export const MAX_LIST_ITEMS = 20;

/**
 * G2 native list widget per-item text cap, in UTF-8 bytes (not JS chars) —
 * the firmware rejects the whole rebuild if any item exceeds this, and
 * titles with accented/multi-byte characters (common in Portuguese task
 * names here) can overflow well before 63 JS `.length` characters.
 */
export const MAX_ITEM_BYTES = 63;

// ---------------------------------------------------------------------------
// Display geometry (G2: 576×288 monochrome, even pixels)
// ---------------------------------------------------------------------------

/** Display width in pixels. */
export const SCREEN_W = 576;

/** Display height in pixels. */
export const SCREEN_H = 288;

/** Header band height in pixels. */
export const HEADER_H = 52;

/** Native-list band height in pixels. */
export const LIST_H = SCREEN_H - HEADER_H;

/** Inner padding for text containers, in pixels. */
export const CONTAINER_PADDING = 8;

// ---------------------------------------------------------------------------
// Container IDs and names (stable across the app lifetime)
// ---------------------------------------------------------------------------
// The G2 firmware matches rebuild/upgrade containers by name+ID against the
// containers createStartUpPageContainer first established — giving a
// container a new name per screen makes rebuildPageContainer silently fail
// (returns false, list never updates). Names are also capped at 16 chars.

/** Header text container ID. */
export const CONTAINER_ID_HEADER = 1;

/** Native list container ID. */
export const CONTAINER_ID_LIST = 2;

/** Header text container name (must stay stable). */
export const HEADER_CONTAINER_NAME = 'ub-header';

/** Native list container name (must stay stable). */
export const LIST_CONTAINER_NAME = 'ub-list';

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

/** Minimum interval between scroll events, in milliseconds. */
export const SCROLL_COOLDOWN_MS = 300;

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

/** ASCII spinner frames cycled while a background fetch is in flight. */
export const SPINNER_FRAMES: readonly string[] = ['|', '/', '-', '\\'];

/** Spinner tick interval, in milliseconds. */
export const SPINNER_INTERVAL_MS = 250;

// ---------------------------------------------------------------------------
// STT / Vosk
// ---------------------------------------------------------------------------

/** Path (relative to the web root) where the Vosk model tarball is served. */
export const VOSK_MODEL_URL = '/vosk/model.tar.gz';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/** Screen name to fall back to when an unknown screen is requested. */
export const FALLBACK_SCREEN = 'menu';
