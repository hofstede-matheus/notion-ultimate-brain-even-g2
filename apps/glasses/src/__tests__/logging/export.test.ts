// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildLogText } from '../../logging/export';
import { append, clear, seedPreviousSession } from '../../logging/sink';

beforeEach(() => {
  clear();
});

describe('buildLogText', () => {
  it('includes a header block naming the app version and line count', () => {
    append('info', 'NAV', 'menu -> today');
    const text = buildLogText();
    expect(text).toContain('GlassTask log —');
    expect(text).toContain('app test');
    expect(text).toContain('1 lines');
    expect(text).toContain('─'.repeat(40));
  });

  it('includes every buffered line', () => {
    append('info', 'NAV', 'menu -> today');
    append('warn', 'EVT', 'scroll throttled');
    const text = buildLogText();
    expect(text).toContain('menu -> today');
    expect(text).toContain('scroll throttled');
  });

  it('notes the previous-session count in the header and inserts a divider', () => {
    seedPreviousSession([
      { seq: 1, t: 1, level: 'info', cat: 'NAV', msg: 'old line', line: 'old line' },
    ]);
    append('info', 'NAV', 'live line');

    const text = buildLogText();
    expect(text).toContain('(1 from previous session)');
    expect(text).toContain('── previous session ──');

    const dividerIndex = text.indexOf('── previous session ──');
    const oldIndex = text.indexOf('old line');
    const liveIndex = text.indexOf('live line');
    expect(oldIndex).toBeLessThan(dividerIndex);
    expect(dividerIndex).toBeLessThan(liveIndex);
  });

  it('omits the previous-session note and divider when there is no previous session', () => {
    append('info', 'NAV', 'live line');
    const text = buildLogText();
    expect(text).not.toContain('previous session');
  });
});
