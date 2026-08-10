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
 * names here) can overflow well before 63 JS `.length` characters. Kept as
 * a hard backstop even where labels are also pixel-truncated (see
 * `LIST_ITEM_PADDING_X`): this is the one that rejects the whole rebuild.
 */
export const MAX_ITEM_BYTES = 63;

/**
 * Native list item horizontal padding per side, in pixels — from
 * font-measurement's display constants (list items are 40px tall with 12px
 * padding per side). Used to pixel-truncate list labels against what the
 * widget actually clips, rather than approximating by byte count.
 */
export const LIST_ITEM_PADDING_X = 12;

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
 * uppercase text and cost a line to a silent extra wrap. Deliberately left
 * as a character budget rather than switched to pixel-accurate wrapping
 * (`even-toolkit/pretext`'s `measureTextWrap`) — reworking pagination
 * boundaries for every existing note/task is a separate, larger change than
 * the truncation-only pixel-accuracy pass this budget was reviewed against.
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

/**
 * The due-date calendar's four image containers, quartering one logical
 * 576×204 pixel buffer into 288×102 tiles. 288×144 is the real per-container
 * limit on hardware (SDK `index.d.ts`: width 20–288, height 20–144); 200×100
 * is a limit of the desktop simulator only (`@evenrealities/evenhub-simulator`,
 * pinned to 0.7.3 in package.json), not the firmware.
 *
 * Unlike the header/list containers, these are declared ONLY on the bitmap
 * screen — not on every rebuild — so every other screen in the app stays
 * within the simulator's 4-container cap. This is a deliberate exception to
 * the "every container must appear in every rebuild" rule below; see
 * render/containers.ts's `calendarContainers()` for the fallback if it turns
 * out hardware needs them declared unconditionally too.
 */
export const CONTAINER_ID_IMG_A = 3;
export const CONTAINER_ID_IMG_B = 4;
export const CONTAINER_ID_IMG_C = 5;
export const CONTAINER_ID_IMG_D = 6;
export const IMG_CONTAINER_NAME_A = 'ub-cal-a';
export const IMG_CONTAINER_NAME_B = 'ub-cal-b';
export const IMG_CONTAINER_NAME_C = 'ub-cal-c';
export const IMG_CONTAINER_NAME_D = 'ub-cal-d';

/**
 * The due-date calendar's two label text containers (above/below the image
 * grid) plus the full-screen event-sink container id=1 becomes on this
 * screen — see render/containers.ts's `calendarContainers()`.
 */
export const CONTAINER_ID_CAL_TOP = 7;
export const CONTAINER_ID_CAL_BOTTOM = 8;
export const CAL_TOP_CONTAINER_NAME = 'ub-cal-top';
export const CAL_BOTTOM_CONTAINER_NAME = 'ub-cal-bot';

// ---------------------------------------------------------------------------
// Due-date calendar bitmap geometry — one 576×204 logical buffer, quartered
// into four 288×102 image tiles (2 cols × 2 rows), full-width under a top
// label band and above a bottom hint band. See bitmap/ and
// modules/tasks/calendar/.
// ---------------------------------------------------------------------------

export const CAL_BUF_W = 576;
export const CAL_BUF_H = 204;
export const CAL_TILE_W = 288;
export const CAL_TILE_H = 102;

/** y position (in screen coordinates) where the image tiles start. */
export const CAL_BAND_Y = 54;
/** Top label container ("CHANGE DUE" / month+year), above the image tiles. */
export const CAL_TOP_TEXT_H = CAL_BAND_Y;
/** Bottom hint container (gesture instructions), below the image tiles. */
export const CAL_BOT_TEXT_Y = CAL_BAND_Y + CAL_BUF_H;
export const CAL_BOT_TEXT_H = SCREEN_H - CAL_BOT_TEXT_Y;

// Bands within the 576×204 buffer itself:
export const CAL_NAV_H = 14;
export const CAL_WEEKDAY_Y = 14;
export const CAL_WEEKDAY_H = 16;
export const CAL_RULE_Y = 30;
export const CAL_GRID_Y = 31;
export const CAL_ROW_H = 26;
export const CAL_GRID_ROWS = 6;
export const CAL_NAV_NEXT_Y = 188;

export const CAL_COL_X0 = 1;
export const CAL_COL_W = 82;

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

/** Minimum duration the boot splash remains visible before the next screen. */
export const BOOT_SPLASH_MIN_MS = 1000;

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
