import {
  ImageContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk';
import {
  CAL_BAND_Y,
  CAL_BOT_TEXT_H,
  CAL_BOT_TEXT_Y,
  CAL_BOTTOM_CONTAINER_NAME,
  CAL_TILE_H,
  CAL_TILE_W,
  CAL_TOP_CONTAINER_NAME,
  CAL_TOP_TEXT_H,
  CONTAINER_ID_CAL_BOTTOM,
  CONTAINER_ID_CAL_TOP,
  CONTAINER_ID_HEADER,
  CONTAINER_ID_IMG_A,
  CONTAINER_ID_IMG_B,
  CONTAINER_ID_IMG_C,
  CONTAINER_ID_IMG_D,
  CONTAINER_ID_LIST,
  HEADER_CONTAINER_NAME,
  IMG_CONTAINER_NAME_A,
  IMG_CONTAINER_NAME_B,
  IMG_CONTAINER_NAME_C,
  IMG_CONTAINER_NAME_D,
  LIST_CONTAINER_NAME,
  SCREEN_H,
  SCREEN_W,
} from '../constants';

/**
 * Inert placeholder for container id=2 on text-only screens. The G2 firmware
 * fails to re-add a container that was absent from the immediately preceding
 * rebuild (even with a stable name/ID) — so id=2 must appear in every single
 * rebuild for the app's lifetime, never just id=1. 1x1 + isEventCapture:0
 * keeps it visually and functionally inert.
 */
export function placeholderListContainer(): ListContainerProperty {
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
  });
}

/**
 * The due-date calendar's full-screen event sink. Container id=1 is the
 * header everywhere else in the app, but on the bitmap screen it becomes a
 * blank, non-overflowing capture surface instead — a container whose visible
 * *content* can overflow and has `isEventCapture: 1` is exactly the trap
 * that made swipes scroll the old text panel instead of moving the calendar
 * cursor (an overflowing capturing text container triggers the firmware's
 * internal scroll). `content: ' '` can never overflow, so every swipe fires
 * immediately as `SCROLL_TOP_EVENT`/`SCROLL_BOTTOM_EVENT` instead of being
 * consumed by the firmware's internal scroll. Declared first / lowest ID so
 * it draws behind the label and image containers on top of it.
 */
export function calendarSinkContainer(): TextContainerProperty {
  return new TextContainerProperty({
    containerID: CONTAINER_ID_HEADER,
    containerName: HEADER_CONTAINER_NAME,
    content: ' ',
    xPosition: 0,
    yPosition: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    isEventCapture: 1,
    paddingLength: 0,
  });
}

/** "CHANGE DUE" + month/year, above the calendar image grid. Non-capturing — overflow just clips. */
export function calendarTopTextContainer(text: string): TextContainerProperty {
  return new TextContainerProperty({
    containerID: CONTAINER_ID_CAL_TOP,
    containerName: CAL_TOP_CONTAINER_NAME,
    content: text,
    xPosition: 0,
    yPosition: 0,
    width: SCREEN_W,
    height: CAL_TOP_TEXT_H,
    isEventCapture: 0,
    paddingLength: 0,
  });
}

/** Gesture hint line, below the calendar image grid. Non-capturing — overflow just clips. */
export function calendarBottomTextContainer(text: string): TextContainerProperty {
  return new TextContainerProperty({
    containerID: CONTAINER_ID_CAL_BOTTOM,
    containerName: CAL_BOTTOM_CONTAINER_NAME,
    content: text,
    xPosition: 0,
    yPosition: CAL_BOT_TEXT_Y,
    width: SCREEN_W,
    height: CAL_BOT_TEXT_H,
    isEventCapture: 0,
    paddingLength: 0,
  });
}

/**
 * Quarters the calendar's logical 576×204 pixel buffer into four 288×102
 * SDK image tiles (2 cols × 2 rows), positioned under the top label band.
 * 288×144 is the real per-container limit on hardware; only the desktop
 * simulator caps at 200×100 (see constants.ts). Declared only while the
 * bitmap screen is showing — not on every rebuild — so every other screen
 * stays within the simulator's 4-container cap.
 */
export function calendarImageContainers(): ImageContainerProperty[] {
  return [
    new ImageContainerProperty({
      containerID: CONTAINER_ID_IMG_A,
      containerName: IMG_CONTAINER_NAME_A,
      xPosition: 0,
      yPosition: CAL_BAND_Y,
      width: CAL_TILE_W,
      height: CAL_TILE_H,
    }),
    new ImageContainerProperty({
      containerID: CONTAINER_ID_IMG_B,
      containerName: IMG_CONTAINER_NAME_B,
      xPosition: CAL_TILE_W,
      yPosition: CAL_BAND_Y,
      width: CAL_TILE_W,
      height: CAL_TILE_H,
    }),
    new ImageContainerProperty({
      containerID: CONTAINER_ID_IMG_C,
      containerName: IMG_CONTAINER_NAME_C,
      xPosition: 0,
      yPosition: CAL_BAND_Y + CAL_TILE_H,
      width: CAL_TILE_W,
      height: CAL_TILE_H,
    }),
    new ImageContainerProperty({
      containerID: CONTAINER_ID_IMG_D,
      containerName: IMG_CONTAINER_NAME_D,
      xPosition: CAL_TILE_W,
      yPosition: CAL_BAND_Y + CAL_TILE_H,
      width: CAL_TILE_W,
      height: CAL_TILE_H,
    }),
  ];
}
