import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { trace } from '../../logging/trace';
import type { ScreenName } from '../../state';
import { getBridge, state } from '../../state';
import {
  CONTAINER_ID_HEADER,
  CONTAINER_ID_LIST,
  CONTAINER_PADDING,
  HEADER_CONTAINER_NAME,
  HEADER_H,
  LIST_CONTAINER_NAME,
  LIST_H,
  SCREEN_H,
  SCREEN_W,
} from '../constants';
import { router } from '../router';
import { placeholderListContainer } from './containers';

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

/** Full container rebuild. Assumes `state.screen === screen` already. */
export async function renderFull(): Promise<void> {
  const display = currentDisplay();
  trace.debug(
    'RENDER',
    `full mode=${display.mode} screen=${state.screen}`,
    display.mode === 'list' ? { items: display.items.length } : undefined,
  );

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
 * In-place header-only content upgrade (spinner ticks). No-op if the user
 * has navigated away from `screen`. There is no partial-list-update API —
 * list items only ever change via a full renderFull() rebuild.
 */
export async function renderUpdate(screen: ScreenName): Promise<void> {
  if (state.screen !== screen) {
    trace.debug('RENDER', `update skipped — navigated away from ${screen} to ${state.screen}`);
    return;
  }
  const b = getBridge();
  if (!b) {
    trace.warn('RENDER', 'no bridge — frame dropped');
    return;
  }

  const display = currentDisplay();
  const content = display.mode === 'text' ? display.content : display.header;

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CONTAINER_ID_HEADER,
      containerName: HEADER_CONTAINER_NAME,
      content,
    }),
  );
}
