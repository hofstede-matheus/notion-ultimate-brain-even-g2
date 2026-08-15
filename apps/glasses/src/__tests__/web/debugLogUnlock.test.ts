import { describe, expect, it } from 'vitest';
import {
  isDebugLogVisible,
  LOG_UNLOCK_TAPS,
  nextUnlockTap,
} from '../../web/screens/SettingsForm/debugLogUnlock';

describe('nextUnlockTap', () => {
  it('stays locked until the tenth tap', () => {
    let count = 0;
    for (let i = 0; i < LOG_UNLOCK_TAPS - 1; i++) {
      const result = nextUnlockTap(count);
      count = result.count;
      expect(result.unlocked).toBe(false);
    }
    expect(count).toBe(LOG_UNLOCK_TAPS - 1);
  });

  it('unlocks on the tenth tap', () => {
    const result = nextUnlockTap(LOG_UNLOCK_TAPS - 1);
    expect(result.count).toBe(LOG_UNLOCK_TAPS);
    expect(result.unlocked).toBe(true);
  });

  it('stays unlocked after further taps', () => {
    const result = nextUnlockTap(LOG_UNLOCK_TAPS);
    expect(result.count).toBe(LOG_UNLOCK_TAPS + 1);
    expect(result.unlocked).toBe(true);
  });
});

describe('isDebugLogVisible', () => {
  it('is visible in local dev without unlocking', () => {
    expect(isDebugLogVisible(false, true)).toBe(true);
  });

  it('requires unlock in a built app', () => {
    expect(isDebugLogVisible(false, false)).toBe(false);
    expect(isDebugLogVisible(true, false)).toBe(true);
  });
});
