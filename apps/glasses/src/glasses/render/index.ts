import {
  CreateStartUpPageContainer,
  type ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { trace } from '../../logging/trace';
import type { ScreenName } from '../../state';
import { getBridge, state } from '../../state';
import { encodeBmp, fnv32a } from '../bitmap/bmp';
import { sliceRect } from '../bitmap/pixels';
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
  CONTAINER_ID_IMG_C,
  CONTAINER_ID_IMG_D,
  CONTAINER_ID_LIST,
  CONTAINER_PADDING,
  HEADER_CONTAINER_NAME,
  HEADER_H,
  IMG_CONTAINER_NAME_A,
  IMG_CONTAINER_NAME_B,
  IMG_CONTAINER_NAME_C,
  IMG_CONTAINER_NAME_D,
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
    await b.createStartUpPageContainer(new CreateStartUpPageContainer(config));
    state.startupRendered = true;
    return;
  }

  await b.rebuildPageContainer(new RebuildPageContainer(config));
}

/**
 * Per-tile FNV-1a hash of the last successfully sent calendar frame — lets
 * `sendCalendarTiles` skip re-sending a tile whose bytes haven't changed
 * (most swipes only touch one quadrant of the buffer). Cleared whenever a
 * non-bitmap screen renders, so re-entering the picker always redraws all
 * four tiles instead of trusting stale state from a previous session.
 */
let lastTileHash: [number | null, number | null, number | null, number | null] = [
  null,
  null,
  null,
  null,
];

/**
 * Whether the 8-container bitmap layout is already live on the device. Set
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

/** Full container rebuild. Assumes `state.screen === screen` already. */
export async function renderFull(): Promise<void> {
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
        containerTotalNum: 8,
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

  bitmapContainersLive = false;
  lastCalTopText = null;
  lastCalBottomText = null;
  lastTileHash = [null, null, null, null];

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
    await b.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_ID_CAL_TOP,
        containerName: CAL_TOP_CONTAINER_NAME,
        content: topText,
      }),
    );
    lastCalTopText = topText;
  }

  if (bottomText !== lastCalBottomText) {
    await b.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_ID_CAL_BOTTOM,
        containerName: CAL_BOTTOM_CONTAINER_NAME,
        content: bottomText,
      }),
    );
    lastCalBottomText = bottomText;
  }
}

/**
 * Quarters the calendar's logical 576×204 pixel buffer into the four SDK
 * image tiles, encodes each as a 1-bit BMP, and sends only the tiles whose
 * bytes changed since the last frame — sequentially, per
 * `updateImageRawData`'s documented "no concurrent image sends" constraint.
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
    {
      id: CONTAINER_ID_IMG_C,
      name: IMG_CONTAINER_NAME_C,
      rect: sliceRect(pixels, CAL_BUF_W, 0, CAL_TILE_H, CAL_TILE_W, CAL_TILE_H),
    },
    {
      id: CONTAINER_ID_IMG_D,
      name: IMG_CONTAINER_NAME_D,
      rect: sliceRect(pixels, CAL_BUF_W, CAL_TILE_W, CAL_TILE_H, CAL_TILE_W, CAL_TILE_H),
    },
  ];

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (!tile) continue;
    const bmp = encodeBmp(tile.rect, CAL_TILE_W, CAL_TILE_H);
    const hash = fnv32a(bmp);
    if (lastTileHash[i] === hash) continue;

    try {
      const result = await b.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: tile.id,
          containerName: tile.name,
          imageData: Array.from(bmp),
        }),
      );
      if (ImageRawDataUpdateResult.isSuccess(result)) {
        lastTileHash[i] = hash;
      } else {
        trace.warn('RENDER', `calendar tile ${tile.name} send failed`, { result });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      trace.error('RENDER', `calendar tile ${tile.name} send threw: ${msg}`);
    }
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

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CONTAINER_ID_HEADER,
      containerName: HEADER_CONTAINER_NAME,
      content,
    }),
  );
}
