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

  it('caps a long string ctx value at 200 chars with an ellipsis', () => {
    const long = `${'word '.repeat(50)}extra`; // 201 chars; spaces break base64 redaction
    append('info', 'API', 'loaded', { detail: long });
    const stored = getSnapshot()[0]?.ctx?.detail;
    expect(typeof stored).toBe('string');
    expect((stored as string).length).toBe(201); // 200 chars + ellipsis char
    expect(stored).toMatch(/…$/);
    expect(stored).toBe(`${long.slice(0, 200)}…`);
  });

  it('leaves a string ctx value at exactly 200 chars uncapped', () => {
    const exact = 'word '.repeat(40); // 200 chars; spaces break base64 redaction
    append('info', 'API', 'loaded', { detail: exact });
    expect(getSnapshot()[0]?.ctx?.detail).toBe(exact);
  });

  it('summarises an array ctx value by length', () => {
    append('info', 'API', 'loaded', { items: [1, 2, 3] });
    expect(getSnapshot()[0]?.ctx?.items).toBe('<array len=3>');
  });

  it('stores a small object ctx value as redacted JSON', () => {
    append('info', 'API', 'loaded', { meta: { count: 12 } });
    expect(getSnapshot()[0]?.ctx?.meta).toBe('{"count":12}');
  });

  it('summarises an oversized object ctx value by serialised length', () => {
    append('info', 'API', 'loaded', { meta: { blob: 'z'.repeat(250) } });
    const stored = getSnapshot()[0]?.ctx?.meta;
    expect(stored).toMatch(/^<object len=\d+>$/);
  });

  it('stores unserialisable object ctx values as a placeholder', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    append('info', 'API', 'loaded', { bad: circular });
    expect(getSnapshot()[0]?.ctx?.bad).toBe('<unserialisable>');
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

  it('notifies subscribers', () => {
    const listener = vi.fn();
    subscribe(listener);
    seedPreviousSession([
      { seq: 1, t: 1, level: 'info', cat: 'NAV', msg: 'old line', line: 'old line' },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
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
