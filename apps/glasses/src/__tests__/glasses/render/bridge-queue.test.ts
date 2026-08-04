/**
 * bridge-queue.ts serializes glasses-bound bridge calls behind a single
 * promise chain with a per-call timeout — see glasses-ui's "serialize all
 * bridge calls, not just images" and "add a per-call timeout to BLE calls"
 * guidance. Tested directly (not only through render/render.test.ts's
 * wiring checks) since it's a general-purpose primitive other call sites
 * (voice.ts's audioControl, events/index.ts's teardown) will also route
 * through.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, resetBridgeQueue } from '../../../glasses/bridge-queue';
import { clear as clearLog, getSnapshot as getLogSnapshot } from '../../../logging/sink';

beforeEach(() => {
  resetBridgeQueue();
  clearLog();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('serialization', () => {
  it('never runs a second call before the first has settled', async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = enqueue(
      'first',
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = () => {
            order.push('first');
            resolve();
          };
        }),
    );
    const second = enqueue('second', async () => {
      order.push('second');
    });

    // Give 'second' every chance to jump the queue if it were going to.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(order).toEqual([]);

    releaseFirst?.();
    await first;
    await second;

    expect(order).toEqual(['first', 'second']);
  });

  it("one call's rejection does not poison the chain for the next", async () => {
    const failing = enqueue('failing', () => Promise.reject(new Error('boom')));
    const next = enqueue('next', async () => 'ok');

    await expect(failing).resolves.toBeUndefined();
    await expect(next).resolves.toBe('ok');
  });
});

describe('failure handling', () => {
  it('resolves undefined and logs an error when the call throws', async () => {
    const result = await enqueue('boom', () => Promise.reject(new Error('offline')));

    expect(result).toBeUndefined();
    const errors = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.msg).toContain('boom');
    expect(errors[0]?.ctx?.error).toContain('offline');
  });

  it('resolves undefined and logs an error when the call times out', async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});

    const resultPromise = enqueue('stuck', () => never);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result).toBeUndefined();
    const errors = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.msg).toContain('timed out');
    expect(errors[0]?.msg).toContain('stuck');
  });

  it('a later call still runs after an earlier one times out', async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});

    const stuck = enqueue('stuck', () => never);
    const after = enqueue('after', async () => 'ok');

    await vi.advanceTimersByTimeAsync(5000);
    await expect(stuck).resolves.toBeUndefined();
    await expect(after).resolves.toBe('ok');
  });
});
