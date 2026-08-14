import {
  CreateStartUpPageContainer,
  type ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { trace } from '../../logging/trace';
import type { ScreenName } from '../../state';
import { getBridge, state } from '../../state';
import { encodeBmp, fnv32a } from '../bitmap/bmp';
import { sliceRect } from '../bitmap/pixels';
import { enqueue } from '../bridge-queue';
import {
  CAL_BOTTOM_CONTAINER_NAME,
  CAL_BUF_W,
  CAL_TILE_H,
  CAL_TILE_W,
  CAL_TOP_CONTAINER_NAME,
  CONTAINER_ID_CAL_BOTTOM,
  CONTAINER_ID_CAL_TOP,
  CONTAINER_ID_HEADER,
  CONTAINER_ID_IMG_A,
  CONTAINER_ID_IMG_B,
  CONTAINER_ID_LIST,
  CONTAINER_PADDING,
  HEADER_CONTAINER_NAME,
  HEADER_H,
  IMG_CONTAINER_NAME_A,
  IMG_CONTAINER_NAME_B,
  LIST_CONTAINER_NAME,
  LIST_H,
  SCREEN_H,
  SCREEN_W,
} from '../constants';
import { router } from '../router';
import {
  calendarBottomTextContainer,
  calendarImageContainers,
  calendarSinkContainer,
  calendarTopTextContainer,
  placeholderListContainer,
} from './containers';

function currentDisplay() {
  return router.toDisplayData(state);
}

// ---------------------------------------------------------------------------
// Startup result decoding — hand-mapped rather than relying on the enum's
// reverse mapping, same reasoning as events/resolve.ts's eventTypeName: the
// SDK ships a minified bundle, and numeric-enum reverse lookup isn't
// guaranteed to survive that.
// ---------------------------------------------------------------------------

const STARTUP_RESULT_NAMES: Record<number, string> = {
  [StartUpPageCreateResult.success]: 'success',
  [StartUpPageCreateResult.invalid]: 'invalid',
  [StartUpPageCreateResult.oversize]: 'oversize',
  [StartUpPageCreateResult.outOfMemory]: 'outOfMemory',
};

function startUpResultName(result: StartUpPageCreateResult | undefined): string {
  if (result === undefined) return 'no response (bridge-queue timeout/throw)';
  return STARTUP_RESULT_NAMES[result] ?? `unknown(${result})`;
}

/**
 * Thrown when `createStartUpPageContainer` doesn't return `success`.
 * `state.startupRendered` is left `false` so a retry can attempt startup
 * again — the SDK documents it as one-shot, so a retry may also be refused,
 * but that will now be logged rather than producing a silent blank display.
 * Caught in boot.ts's `connect()` to show a distinct status message.
 */
export class StartupRejectedError extends Error {
  constructor(public readonly result: StartUpPageCreateResult | undefined) {
    super(`startup page rejected: ${startUpResultName(result)}`);
    this.name = 'StartupRejectedError';
  }
}

// ---------------------------------------------------------------------------
// Rebuild helper — handles first-call (startup) vs subsequent (rebuild)
// ---------------------------------------------------------------------------

async function rebuildPage(config: {
  containerTotalNum: number;
  textObject?: TextContainerProperty[];
  listObject?: ListContainerProperty[];
  imageObject?: ImageContainerProperty[];
}): Promise<void> {
  const b = getBridge();
  if (!b) {
    trace.warn('RENDER', 'no bridge — frame dropped');
    return;
  }

  if (!state.startupRendered) {
    const result = await enqueue('createStartUpPageContainer', () =>
      b.createStartUpPageContainer(new CreateStartUpPageContainer(config)),
    );
    if (result !== StartUpPageCreateResult.success) {
      trace.error('RENDER', `startup rejected: ${startUpResultName(result)}`, { result });
      throw new StartupRejectedError(result);
    }
    state.startupRendered = true;
    return;
  }

  const ok = await enqueue('rebuildPageContainer', () =>
    b.rebuildPageContainer(new RebuildPageContainer(config)),
  );
  if (ok === false) {
    trace.warn('RENDER', 'rebuildPageContainer rejected', {
      containers: config.containerTotalNum,
    });
  }
}

/**
 * Per-tile FNV-1a hash of the last successfully sent calendar frame — lets
 * `sendCalendarTiles` skip re-sending a tile whose bytes haven't changed
 * (a day move usually only touches one of the two tiles). Cleared whenever a
 * non-bitmap screen renders, so re-entering the picker always redraws both
 * tiles instead of trusting stale state from a previous session — and
 * cleared on an image-send timeout (see bridge-queue's per-call timeout),
 * since a timed-out send leaves the device's tile state unknowable.
 */
let lastTileHash: [number | null, number | null] = [null, null];

/**
 * Whether the 6-container bitmap layout is already live on the device. Set
 * once on the first render of a bitmap-screen "session" and cleared the
 * moment a non-bitmap screen renders. While true, subsequent renders must
 * NOT call `rebuildPageContainer` again — doing so re-declares (and thereby
 * resets) the image containers, which silently defeats
 * `sendCalendarTiles`'s per-tile skip: a tile whose pixels didn't change
 * gets skipped on the assumption the container still shows what it showed
 * before, but a rebuild just wiped it back to blank. That mismatch is what
 * made half the calendar (whichever tiles a given cursor move didn't touch)
 * disappear on every navigation.
 */
let bitmapContainersLive = false;
let lastCalTopText: string | null = null;
let lastCalBottomText: string | null = null;

/** Clears the calendar session's cached-frame state (see the fields above). */
function clearCalendarSession(): void {
  bitmapContainersLive = false;
  lastCalTopText = null;
  lastCalBottomText = null;
  lastTileHash = [null, null];
}

/**
 * Exported for the foreground-enter lifecycle handler (glasses/events/index.ts).
 * After a background/foreground cycle we cannot assume the firmware still
 * holds the calendar's image containers, so `sendCalendarTiles`'s per-tile
 * hash skip must not trust state left over from before backgrounding — that
 * mismatch is exactly what `bitmapContainersLive`'s doc comment describes.
 * Does NOT touch `state.startupRendered`, which must survive for the app's
 * lifetime (see `StartupRejectedError`).
 */
export function resetRenderSession(): void {
  clearCalendarSession();
}

/**
 * Tracks whether a `renderFullOnce()` body is currently running, and whether
 * another render was requested while it was in flight — see `renderFull`'s
 * doc comment.
 */
let renderInFlight: Promise<void> | null = null;
let rerenderRequested = false;

/**
 * Full container rebuild. Assumes `state.screen === screen` already.
 *
 * Latest-frame-wins: if a render is already in flight when this is called,
 * marks a rerun instead of starting a second body — sustained gestures
 * (rapid calendar swipes) used to queue one full render per gesture, and
 * since each bitmap render costs hundreds of ms to seconds on real BLE, the
 * display would visibly lag behind and keep "catching up" through stale
 * intermediate frames. The pending rerun always calls `currentDisplay()`
 * fresh when it actually runs, so it reflects whatever state is current at
 * that point — no gesture's *effect on state* is lost, only the extra
 * intermediate *renders* are collapsed into one.
 *
 * A caller that awaits this while a render is already in flight resolves
 * when that earlier render settles, not the coalesced rerun — every
 * existing call site fires this with `void` or only cares that a render
 * eventually happens, not which one it's holding a reference to.
 */
export function renderFull(): Promise<void> {
  if (renderInFlight) {
    rerenderRequested = true;
    return renderInFlight;
  }
  const run = renderFullOnce().finally(() => {
    renderInFlight = null;
    if (rerenderRequested) {
      rerenderRequested = false;
      void renderFull();
    }
  });
  renderInFlight = run;
  return run;
}

async function renderFullOnce(): Promise<void> {
  const display = currentDisplay();
  trace.debug(
    'RENDER',
    `full mode=${display.mode} screen=${state.screen}`,
    display.mode === 'list' ? { items: display.items.length } : undefined,
  );

  if (display.mode === 'bitmap') {
    if (!bitmapContainersLive) {
      // Unlike id=1/id=2 elsewhere, the calendar's image/label containers
      // are declared ONLY here — not on every rebuild — so every other
      // screen in the app stays within the simulator's 4-container cap. If
      // real hardware turns out to need them declared unconditionally too
      // (the firmware quirk id=1/id=2 follow), that's a rebuild here away.
      await rebuildPage({
        containerTotalNum: 6,
        textObject: [
          calendarSinkContainer(),
          calendarTopTextContainer(display.topText),
          calendarBottomTextContainer(display.bottomText),
        ],
        listObject: [placeholderListContainer()],
        imageObject: calendarImageContainers(),
      });
      bitmapContainersLive = true;
      lastCalTopText = display.topText;
      lastCalBottomText = display.bottomText;
    } else {
      await updateCalendarLabels(display.topText, display.bottomText);
    }
    await sendCalendarTiles(display.pixels);
    return;
  }

  clearCalendarSession();

  if (display.mode === 'text') {
    await rebuildPage({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: CONTAINER_ID_HEADER,
          containerName: HEADER_CONTAINER_NAME,
          content: display.content,
          xPosition: 0,
          yPosition: 0,
          width: SCREEN_W,
          height: SCREEN_H,
          isEventCapture: 1,
          paddingLength: CONTAINER_PADDING,
        }),
      ],
      listObject: [placeholderListContainer()],
    });
    return;
  }

  // List mode: header (id=1, non-capturing) + native list (id=2, capturing).
  await rebuildPage({
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: CONTAINER_ID_HEADER,
        containerName: HEADER_CONTAINER_NAME,
        content: display.header,
        xPosition: 0,
        yPosition: 0,
        width: SCREEN_W,
        height: HEADER_H,
        isEventCapture: 0,
        paddingLength: CONTAINER_PADDING,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: CONTAINER_ID_LIST,
        containerName: LIST_CONTAINER_NAME,
        xPosition: 0,
        yPosition: HEADER_H,
        width: SCREEN_W,
        height: LIST_H,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemName: display.items,
          itemCount: display.items.length,
          isItemSelectBorderEn: 1,
        }),
      }),
    ],
  });
}

/**
 * Refreshes the top/bottom calendar labels via `textContainerUpgrade`
 * (skipping a container whose text is unchanged) instead of a full
 * `rebuildPageContainer` — see `bitmapContainersLive` for why a rebuild must
 * not happen again while the picker session is live. Month paging is the
 * only case that actually changes `topText`; cursor moves within a month
 * only change `bottomText` on a week<->day phase switch, if at all.
 */
async function updateCalendarLabels(topText: string, bottomText: string): Promise<void> {
  const b = getBridge();
  if (!b) return;

  if (topText !== lastCalTopText) {
    const ok = await enqueue('textContainerUpgrade(cal-top)', () =>
      b.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID_CAL_TOP,
          containerName: CAL_TOP_CONTAINER_NAME,
          content: topText,
        }),
      ),
    );
    if (ok === false) trace.warn('RENDER', 'cal-top textContainerUpgrade rejected');
    lastCalTopText = topText;
  }

  if (bottomText !== lastCalBottomText) {
    const ok = await enqueue('textContainerUpgrade(cal-bottom)', () =>
      b.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID_CAL_BOTTOM,
          containerName: CAL_BOTTOM_CONTAINER_NAME,
          content: bottomText,
        }),
      ),
    );
    if (ok === false) trace.warn('RENDER', 'cal-bottom textContainerUpgrade rejected');
    lastCalBottomText = bottomText;
  }
}

/**
 * Halves the calendar's logical 576×144 pixel buffer into the two SDK image
 * tiles, encodes each as a 1-bit BMP, and sends only the tiles whose bytes
 * changed since the last frame — sequentially, per `updateImageRawData`'s
 * documented "no concurrent image sends" constraint (now also enforced
 * across screens by bridge-queue's single chain).
 */
async function sendCalendarTiles(pixels: Uint8Array): Promise<void> {
  const b = getBridge();
  if (!b) {
    trace.warn('RENDER', 'no bridge — calendar frame dropped');
    return;
  }

  const tiles: Array<{ id: number; name: string; rect: Uint8Array }> = [
    {
      id: CONTAINER_ID_IMG_A,
      name: IMG_CONTAINER_NAME_A,
      rect: sliceRect(pixels, CAL_BUF_W, 0, 0, CAL_TILE_W, CAL_TILE_H),
    },
    {
      id: CONTAINER_ID_IMG_B,
      name: IMG_CONTAINER_NAME_B,
      rect: sliceRect(pixels, CAL_BUF_W, CAL_TILE_W, 0, CAL_TILE_W, CAL_TILE_H),
    },
  ];

  const startedAt = performance.now();
  let sent = 0;
  let bytes = 0;

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (!tile) continue;
    const bmp = encodeBmp(tile.rect, CAL_TILE_W, CAL_TILE_H);
    const hash = fnv32a(bmp);
    if (lastTileHash[i] === hash) continue;

    const result = await enqueue(
      `updateImageRawData(${tile.name})`,
      () =>
        b.updateImageRawData(
          new ImageRawDataUpdate({
            containerID: tile.id,
            containerName: tile.name,
            imageData: bmp,
          }),
        ),
      'image',
    );
    // undefined means the call already logged an error (threw / timed out) —
    // avoid a second, redundant warn for the same failure. A timeout also
    // means the device's tile state is unknowable, so the hash cache for
    // the WHOLE session (not just this tile) can no longer be trusted.
    if (result !== undefined) {
      if (ImageRawDataUpdateResult.isSuccess(result)) {
        lastTileHash[i] = hash;
        sent++;
        bytes += bmp.length;
      } else {
        trace.warn('RENDER', `calendar tile ${tile.name} send failed`, { result });
      }
    } else {
      lastTileHash = [null, null];
    }
  }

  if (sent > 0) {
    trace.info('CAL', 'tiles sent', {
      tiles: sent,
      bytes,
      ms: Math.round(performance.now() - startedAt),
    });
  }
}

/**
 * In-place header-only content upgrade (spinner ticks). No-op if the user
 * has navigated away from `screen`. There is no partial-list-update API —
 * list items only ever change via a full renderFull() rebuild.
 *
 * Also a no-op in bitmap mode: container id=1 there is the blank event sink
 * (see calendarSinkContainer), and upgrading it with real content would
 * reintroduce the exact overflow-scroll bug this screen was redesigned to
 * avoid. The picker has no background fetch, so nothing ever calls this for
 * it in practice — this guard is a belt-and-braces invariant, not a live path.
 */
export async function renderUpdate(screen: ScreenName): Promise<void> {
  if (state.screen !== screen) {
    trace.debug('RENDER', `update skipped — navigated away from ${screen} to ${state.screen}`);
    return;
  }
  const display = currentDisplay();
  if (display.mode === 'bitmap') {
    trace.debug('RENDER', 'update skipped — bitmap screens only redraw via renderFull()');
    return;
  }

  const b = getBridge();
  if (!b) {
    trace.warn('RENDER', 'no bridge — frame dropped');
    return;
  }

  const content = display.mode === 'text' ? display.content : display.header;

  const ok = await enqueue('textContainerUpgrade(header)', () =>
    b.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_ID_HEADER,
        containerName: HEADER_CONTAINER_NAME,
        content,
      }),
    ),
  );
  if (ok === false) trace.warn('RENDER', 'header textContainerUpgrade rejected');
}
