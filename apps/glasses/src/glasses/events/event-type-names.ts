import { OsEventTypeList } from '@evenrealities/even_hub_sdk';

/**
 * Human-readable name for a numeric OsEventTypeList value, for logging.
 * Hand-mapped rather than relying on the enum's reverse mapping — the SDK
 * ships a minified bundle, and numeric-enum reverse lookup isn't guaranteed
 * to survive that.
 */
export const EVENT_TYPE_NAMES: Record<number, string> = {
  [OsEventTypeList.CLICK_EVENT]: 'CLICK_EVENT',
  [OsEventTypeList.SCROLL_TOP_EVENT]: 'SCROLL_TOP_EVENT',
  [OsEventTypeList.SCROLL_BOTTOM_EVENT]: 'SCROLL_BOTTOM_EVENT',
  [OsEventTypeList.DOUBLE_CLICK_EVENT]: 'DOUBLE_CLICK_EVENT',
  [OsEventTypeList.FOREGROUND_ENTER_EVENT]: 'FOREGROUND_ENTER_EVENT',
  [OsEventTypeList.FOREGROUND_EXIT_EVENT]: 'FOREGROUND_EXIT_EVENT',
  [OsEventTypeList.ABNORMAL_EXIT_EVENT]: 'ABNORMAL_EXIT_EVENT',
  [OsEventTypeList.SYSTEM_EXIT_EVENT]: 'SYSTEM_EXIT_EVENT',
  [OsEventTypeList.IMU_DATA_REPORT]: 'IMU_DATA_REPORT',
};
