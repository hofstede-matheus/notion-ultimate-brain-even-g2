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

  it("does not start the next call until the timed-out call's own promise actually settles", async () => {
    // Regression test: an earlier version let the chain advance the moment
    // a call's timeout fired, before its underlying promise resolved —
    // which let a later `updateImageRawData` start while the timed-out one
    // might still be in flight, violating the SDK's "no concurrent image
    // sends" rule.
    vi.useFakeTimers();
    const order: string[] = [];
    let releaseStuck: (() => void) | undefined;

    const stuck = enqueue(
      'stuck',
      () =>
        new Promise<void>((resolve) => {
          releaseStuck = () => {
            order.push('stuck settled');
            resolve();
          };
        }),
    );
    const after = enqueue('after', async () => {
      order.push('after ran');
      return 'ok';
    });

    await vi.advanceTimersByTimeAsync(5000); // stuck's own per-call timeout fires
    await expect(stuck).resolves.toBeUndefined(); // caller unblocked...
    expect(order).toEqual([]); // ...but 'after' has not started — stuck's promise is still pending

    releaseStuck?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(order).toEqual(['stuck settled', 'after ran']);
    await expect(after).resolves.toBe('ok');
  });

  it('caps how long a permanently hung call can block the chain', async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});
    const order: string[] = [];

    const stuck = enqueue('stuck', () => never);
    const after = enqueue('after', async () => {
      order.push('after ran');
      return 'ok';
    });

    await vi.advanceTimersByTimeAsync(5000); // stuck's own per-call timeout fires
    await expect(stuck).resolves.toBeUndefined();
    expect(order).toEqual([]);

    await vi.advanceTimersByTimeAsync(25000); // hard settle-wait cap elapses
    await expect(after).resolves.toBe('ok');
    expect(order).toEqual(['after ran']);
  });

  it('an image-kind call gets a longer timeout than the default', async () => {
    vi.useFakeTimers();
    const slow = enqueue('slow-image', () => new Promise<string>(() => {}), 'image');

    await vi.advanceTimersByTimeAsync(5000); // past the default timeout...
    const errorsAt5s = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errorsAt5s).toHaveLength(0); // ...but the image call hasn't timed out yet

    await vi.advanceTimersByTimeAsync(10000); // past the 15s image timeout
    await expect(slow).resolves.toBeUndefined();
    const errorsAt15s = getLogSnapshot().filter((r) => r.level === 'error');
    expect(errorsAt15s.some((r) => r.msg.includes('slow-image'))).toBe(true);
  });
});
