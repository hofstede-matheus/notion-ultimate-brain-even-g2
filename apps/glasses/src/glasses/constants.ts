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
// Page reader (task-page screen)
// ---------------------------------------------------------------------------
// A Notion page can't simply be dumped into a text container and scrolled by
// the firmware: rebuildPageContainer caps `content` at 1000 characters — under
// two screenfuls — and there is no API to read or set the firmware's scroll
// offset, so there'd be no way to show progress. The reader pre-paginates
// instead, and each page MUST fit the container with zero overflow: leftover
// overflow re-arms the firmware's internal scroll, which then swallows swipes
// until it hits a boundary and the page-turn gestures become erratic.

/**
 * Content lines per reader page. The container fits 10 lines (272px inner
 * height at CONTAINER_PADDING, over a 27px line height); the header and the
 * blank line under it take the other two.
 */
export const READER_LINES_PER_PAGE = 8;

/**
 * Word-wrap width in characters. The G2 font is proportional, so this is a
 * budget rather than a measurement: at 42 characters even an all-caps line
 * measures 547px against the 560px inner width, while ordinary prose lands
 * near 400px. Wider settings (the toolkit's default of 46) overflow on
 * uppercase text and cost a line to a silent extra wrap.
 */
export const READER_CHARS_PER_LINE = 42;

/** Indent added per level of block nesting. */
export const READER_INDENT = '  ';

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
