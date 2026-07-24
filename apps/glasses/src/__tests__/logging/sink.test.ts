import { beforeEach, describe, expect, it, vi } from 'vitest';
import { append, clear, getSnapshot, seedPreviousSession, subscribe } from '../../logging/sink';
import { LOG_BUFFER_SIZE } from '../../logging/types';

beforeEach(() => {
  clear();
});

describe('append', () => {
  it('adds a record with a pre-rendered line', () => {
    append('info', 'NAV', 'menu -> today');
    const [record] = getSnapshot();
    expect(record.level).toBe('info');
    expect(record.cat).toBe('NAV');
    expect(record.msg).toBe('menu -> today');
    expect(record.line).toContain('NAV');
    expect(record.line).toContain('menu -> today');
  });

  it('assigns strictly increasing seq numbers', () => {
    append('info', 'NAV', 'a');
    append('info', 'NAV', 'b');
    const [first, second] = getSnapshot();
    expect(second.seq).toBeGreaterThan(first.seq);
  });

  it('returns a new array reference on every append (useSyncExternalStore contract)', () => {
    append('info', 'NAV', 'a');
    const before = getSnapshot();
    append('info', 'NAV', 'b');
    const after = getSnapshot();
    expect(after).not.toBe(before);
  });

  it('notifies subscribers on append', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    append('info', 'NAV', 'a');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    append('info', 'NAV', 'b');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('prunes the oldest entries once the buffer exceeds LOG_BUFFER_SIZE', () => {
    for (let i = 0; i < LOG_BUFFER_SIZE + 10; i++) {
      append('info', 'NAV', `entry-${i}`);
    }
    const entries = getSnapshot();
    expect(entries.length).toBe(LOG_BUFFER_SIZE);
    expect(entries[0]?.msg).toBe('entry-10');
    expect(entries[entries.length - 1]?.msg).toBe(`entry-${LOG_BUFFER_SIZE + 9}`);
  });
});

describe('seedPreviousSession', () => {
  it('prepends tagged records ahead of live ones', () => {
    append('info', 'NAV', 'live line');
    seedPreviousSession([
      { seq: 1, t: 1, level: 'info', cat: 'NAV', msg: 'old line', line: 'old line' },
    ]);
    const entries = getSnapshot();
    expect(entries[0]?.previousSession).toBe(true);
    expect(entries[0]?.msg).toBe('old line');
    expect(entries[1]?.msg).toBe('live line');
    expect(entries[1]?.previousSession).toBeUndefined();
  });

  it('is a no-op for an empty array', () => {
    append('info', 'NAV', 'live line');
    const before = getSnapshot();
    seedPreviousSession([]);
    expect(getSnapshot()).toBe(before);
  });
});

describe('clear', () => {
  it('empties the buffer and notifies subscribers', () => {
    append('info', 'NAV', 'a');
    const listener = vi.fn();
    subscribe(listener);
    clear();
    expect(getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
