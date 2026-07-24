import { describe, expect, it } from 'vitest';
import { isSimulatorNoiseLog } from '../../web/utils/consoleNoise';

describe('isSimulatorNoiseLog', () => {
  it('matches the simulator heartbeat message', () => {
    expect(isSimulatorNoiseLog(['[Simulator] Flutter Bridge intercepted: evenAppMessage'])).toBe(
      true,
    );
  });

  it('ignores ordinary log lines', () => {
    expect(isSimulatorNoiseLog(['GET /api/tasks/today 200 OK'])).toBe(false);
  });

  it('ignores non-string args', () => {
    expect(isSimulatorNoiseLog([{ some: 'object' }, 42])).toBe(false);
  });

  it('matches when the string is not the only arg', () => {
    expect(
      isSimulatorNoiseLog(['prefix', '[Simulator] Flutter Bridge intercepted: evenAppMessage']),
    ).toBe(true);
  });
});
