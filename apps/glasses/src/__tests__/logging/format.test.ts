import { describe, expect, it } from 'vitest';
import { formatArgs, formatRecord, formatTime, previewBody } from '../../logging/format';

const T = new Date(2026, 0, 1, 9, 5, 3, 42).getTime();

describe('formatTime', () => {
  it('renders zero-padded HH:MM:SS.mmm', () => {
    expect(formatTime(T)).toBe('09:05:03.042');
  });
});

describe('formatRecord', () => {
  it('pads level and category into fixed-width columns', () => {
    const line = formatRecord(T, 'info', 'NAV', 'menu -> today');
    expect(line).toBe('09:05:03.042 INFO  NAV    menu -> today');
  });

  it('pads the longest level (ERROR) and category (RENDER) without truncating', () => {
    const line = formatRecord(T, 'error', 'RENDER', 'no bridge');
    expect(line).toBe('09:05:03.042 ERROR RENDER no bridge');
  });

  it('appends ctx as key=value pairs', () => {
    const line = formatRecord(T, 'info', 'API', 'loaded today', { items: 12, ms: 340 });
    expect(line).toBe('09:05:03.042 INFO  API    loaded today  items=12 ms=340');
  });

  it('quotes a ctx string value containing spaces', () => {
    const line = formatRecord(T, 'info', 'SEL', 'row', { name: 'Buy milk' });
    expect(line).toContain('name="Buy milk"');
  });

  it('omits the ctx suffix entirely when ctx is undefined', () => {
    const line = formatRecord(T, 'debug', 'CACHE', 'miss key');
    expect(line).toBe('09:05:03.042 DEBUG CACHE  miss key');
  });
});

describe('formatArgs', () => {
  it('passes a single string through unchanged', () => {
    expect(formatArgs(['hello world'])).toBe('hello world');
  });

  it('formats an Error with its stack', () => {
    const err = new Error('boom');
    const out = formatArgs([err]);
    expect(out).toContain('Error: boom');
  });

  it('JSON-stringifies a plain object', () => {
    expect(formatArgs([{ a: 1 }])).toBe('{"a":1}');
  });

  it('joins multiple args with a space', () => {
    expect(formatArgs(['a', 'b', 1])).toBe('a b 1');
  });
});

describe('previewBody', () => {
  it('returns null for a null/undefined body', () => {
    expect(previewBody(null, 200)).resolves.toBeNull();
    expect(previewBody(undefined, 200)).resolves.toBeNull();
  });

  it('caps a string body at maxBytes characters', async () => {
    const body = 'x'.repeat(500);
    await expect(previewBody(body, 10)).resolves.toBe('x'.repeat(10));
  });

  it('summarises a Blob without reading its content', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    await expect(previewBody(blob, 200)).resolves.toBe('<blob:text/plain, 5b>');
  });
});
