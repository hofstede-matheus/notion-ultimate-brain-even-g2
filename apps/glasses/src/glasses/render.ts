import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ListContainerProperty,
  ListItemContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge } from '../state'
import type { Screen as ScreenName } from '../state'
import { router } from './router'
import { currentNav } from './current-nav'
import {
  SCREEN_W,
  SCREEN_H,
  HEADER_H,
  LIST_H,
  CONTAINER_PADDING,
  CONTAINER_ID_HEADER,
  CONTAINER_ID_LIST,
  HEADER_CONTAINER_NAME,
  LIST_CONTAINER_NAME,
} from './constants'

function currentDisplay() {
  return router.toDisplayData(state, currentNav())
}

// ---------------------------------------------------------------------------
// Rebuild helper — handles first-call (startup) vs subsequent (rebuild)
// ---------------------------------------------------------------------------

async function rebuildPage(config: {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
}): Promise<void> {
  const b = getBridge()
  if (!b) return

  if (!state.startupRendered) {
    await b.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    state.startupRendered = true
    return
  }

  await b.rebuildPageContainer(new RebuildPageContainer(config))
}

/**
 * Inert placeholder for container id=2 on text-only screens. The G2 firmware
 * fails to re-add a container that was absent from the immediately preceding
 * rebuild (even with a stable name/ID) — so id=2 must appear in every single
 * rebuild for the app's lifetime, never just id=1. 1x1 + isEventCapture:0
 * keeps it visually and functionally inert.
 */
function placeholderListContainer(): ListContainerProperty {
  return new ListContainerProperty({
    containerID: CONTAINER_ID_LIST,
    containerName: LIST_CONTAINER_NAME,
    xPosition: 0,
    yPosition: 0,
    width: 1,
    height: 1,
    isEventCapture: 0,
    itemContainer: new ListItemContainerProperty({
      itemName: [''],
      itemCount: 1,
      isItemSelectBorderEn: 0,
    }),
  })
}

/** Full container rebuild. Assumes `state.screen === screen` already. */
export async function renderFull(screen: ScreenName): Promise<void> {
  const display = currentDisplay()

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
    })
    return
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
  })
}

/**
 * In-place header-only content upgrade (spinner ticks). No-op if the user
 * has navigated away from `screen`. There is no partial-list-update API —
 * list items only ever change via a full renderFull() rebuild.
 */
export async function renderUpdate(screen: ScreenName): Promise<void> {
  if (state.screen !== screen) return
  const b = getBridge()
  if (!b) return

  const display = currentDisplay()
  const content = display.mode === 'text' ? display.content : display.header

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CONTAINER_ID_HEADER,
      containerName: HEADER_CONTAINER_NAME,
      content,
    }),
  )
}
