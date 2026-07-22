import { ListContainerProperty, ListItemContainerProperty } from '@evenrealities/even_hub_sdk';
import { CONTAINER_ID_LIST, LIST_CONTAINER_NAME } from '../constants';

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
