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

// Container names + IDs MUST stay stable across every render for the whole app
// lifetime. The G2 firmware matches rebuild/upgrade containers by name+ID
// against the containers createStartUpPageContainer first established — giving a
// container a new name per screen makes rebuildPageContainer silently fail
// (returns false, list never updates). Names are also capped at 16 chars.
// See even-g2-context/docs/{display,page-lifecycle}.md and EvenChess's
// CONTAINER_NAME_* constants. id=1 = header/text, id=2 = native list.
const HEADER_CONTAINER_NAME = 'ub-header'
const LIST_CONTAINER_NAME = 'ub-list'

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
    console.log('[debug] createStartUpPageContainer →', JSON.stringify(config))
    const r = await b.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    console.log('[debug] createStartUpPageContainer ←', JSON.stringify(r))
    state.startupRendered = true
    return
  }

  console.log('[debug] rebuildPageContainer →', JSON.stringify(config))
  try {
    const r = await b.rebuildPageContainer(new RebuildPageContainer(config))
    console.log('[debug] rebuildPageContainer ←', JSON.stringify(r))
  } catch (e) {
    console.error('[debug] rebuildPageContainer threw', e)
  }
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

/**
 * Inert placeholder for container id=2 on text-only screens. The G2 firmware
 * fails to re-add a container that was absent from the immediately preceding
 * rebuild (even with a stable name/ID) — so id=2 must appear in every single
 * rebuild for the app's lifetime, never just id=1. 1x1 + isEventCapture:0
 * keeps it visually and functionally inert.
 */
function placeholderListContainer(): ListContainerProperty {
  return new ListContainerProperty({
    containerID: 2,
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
          containerID: 1,
          containerName: HEADER_CONTAINER_NAME,
          content: display.content,
          xPosition: 0,
          yPosition: 0,
          width: W,
          height: H,
          isEventCapture: 1,
          paddingLength: 8,
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
        containerID: 1,
        containerName: HEADER_CONTAINER_NAME,
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
        containerName: LIST_CONTAINER_NAME,
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
      containerName: HEADER_CONTAINER_NAME,
      content,
    }),
  )
}
