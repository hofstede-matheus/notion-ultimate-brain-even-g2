import { afterEach, beforeEach } from 'vitest';
import { makeDriver } from '../driver/app';
import { SIM_URL } from '../env';

/**
 * Shared before/after wiring, imported (not re-declared) by every spec —
 * vitest's default per-file isolation gives each spec file its own instance
 * of this module, so `baselineId` never leaks across files despite being
 * module-level state. See README.md for why every spec goes through
 * resetToRootMenu + assertNoErrors rather than asserting screen content
 * directly (that's the unit suite's job).
 */

export const driver = makeDriver(SIM_URL);

let baselineId = -1;

beforeEach(async () => {
  await driver.resetToRootMenu();
  baselineId = await driver.latestId();
});

afterEach(async () => {
  await driver.assertNoErrors(baselineId);
});
