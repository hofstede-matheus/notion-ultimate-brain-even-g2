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

const W = 576
const H = 288
const HEADER_H = 52
const LIST_H = H - HEADER_H

/** Container name for the id=1 text container (header in list mode, full page in fallback). */
const HEADER_CONTAINER_NAME: Record<ScreenName, string> = {
  menu: 'menu-header',
  overdue: 'overdue-header',
  today: 'today-header',
  inbox: 'inbox-header',
  'add-task': 'voice',
}

/** Container name for the id=2 native list container (Menu/Overdue/Today/Inbox). */
const LIST_CONTAINER_NAME: Record<ScreenName, string> = {
  menu: 'menu-list',
  overdue: 'overdue-list',
  today: 'today-list',
  inbox: 'inbox-list',
  'add-task': '',
}

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
 * Set the active screen and fully rebuild its container(s) from current
 * state. Exported directly (rather than only via glasses/context.ts) so
 * tests and callers can drive a specific screen's render without going
 * through the event dispatcher.
 */
export async function showOverdue(): Promise<void> {
  state.screen = 'overdue'
  await renderFull('overdue')
}

export async function showToday(): Promise<void> {
  state.screen = 'today'
  await renderFull('today')
}

export async function showInbox(): Promise<void> {
  state.screen = 'inbox'
  await renderFull('inbox')
}

/** Full container rebuild. Assumes `state.screen === screen` already. */
export async function renderFull(screen: ScreenName): Promise<void> {
  const display = currentDisplay()

  if (display.mode === 'text') {
    await rebuildPage({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: HEADER_CONTAINER_NAME[screen],
          content: display.content,
          xPosition: 0,
          yPosition: 0,
          width: W,
          height: H,
          isEventCapture: 1,
          paddingLength: 8,
        }),
      ],
    })
    return
  }

  // List mode: header (id=1, non-capturing) + native list (id=2, capturing).
  await rebuildPage({
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: HEADER_CONTAINER_NAME[screen],
        content: display.header,
        xPosition: 0,
        yPosition: 0,
        width: W,
        height: HEADER_H,
        isEventCapture: 0,
        paddingLength: 8,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 2,
        containerName: LIST_CONTAINER_NAME[screen],
        xPosition: 0,
        yPosition: HEADER_H,
        width: W,
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
      containerID: 1,
      containerName: HEADER_CONTAINER_NAME[screen],
      content,
    }),
  )
}
