import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateFilter } from '../filters';

// Mirror the implementation's date math so assertions stay timezone-agnostic.
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

describe('translateFilter', () => {
  describe('relative date keywords', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves "today" to the current ISO date', () => {
      expect(translateFilter({ property: 'Due', date: { on_or_before: 'today' } })).toEqual({
        property: 'Due',
        date: { on_or_before: isoOffset(0) },
      });
    });

    it('resolves "tomorrow" to +1 day', () => {
      expect(translateFilter({ property: 'Due', date: { equals: 'tomorrow' } })).toEqual({
        property: 'Due',
        date: { equals: isoOffset(1) },
      });
    });

    it('resolves "one_week_from_now" to +7 days', () => {
      expect(
        translateFilter({ property: 'Due', date: { on_or_before: 'one_week_from_now' } }),
      ).toEqual({ property: 'Due', date: { on_or_before: isoOffset(7) } });
    });

    it('passes through non-keyword date values unchanged', () => {
      const node = { property: 'Due', date: { equals: '2026-01-01' } };
      expect(translateFilter(node)).toEqual(node);
    });

    it('resolves relative dates against the caller timezone, not UTC', () => {
      // 20:00 UTC on Jul 18 is already Jul 19 05:00 in Tokyo (UTC+9). Without a
      // timezone the date would resolve to the UTC day (Jul 18); with it, the
      // user's local day (Jul 19) — the exact near-midnight off-by-one bug.
      vi.setSystemTime(new Date('2026-07-18T20:00:00.000Z'));

      expect(
        translateFilter({ property: 'Due', date: { on_or_before: 'today' } }, 'Asia/Tokyo'),
      ).toEqual({ property: 'Due', date: { on_or_before: '2026-07-19' } });

      expect(
        translateFilter({ property: 'Due', date: { equals: 'tomorrow' } }, 'Asia/Tokyo'),
      ).toEqual({ property: 'Due', date: { equals: '2026-07-20' } });

      // Same instant, no timezone → falls back to the UTC calendar day.
      expect(translateFilter({ property: 'Due', date: { on_or_before: 'today' } })).toEqual({
        property: 'Due',
        date: { on_or_before: '2026-07-18' },
      });
    });

    it('falls back to UTC for an unknown timezone', () => {
      vi.setSystemTime(new Date('2026-07-18T20:00:00.000Z'));
      expect(translateFilter({ property: 'Due', date: { equals: 'today' } }, 'Not/AZone')).toEqual({
        property: 'Due',
        date: { equals: '2026-07-18' },
      });
    });
  });

  describe('array-valued selects', () => {
    it('expands array equals into an OR group', () => {
      expect(translateFilter({ property: 'Type', select: { equals: ['A', 'B'] } })).toEqual({
        or: [
          { property: 'Type', select: { equals: 'A' } },
          { property: 'Type', select: { equals: 'B' } },
        ],
      });
    });

    it('expands array does_not_equal into an AND group', () => {
      expect(translateFilter({ property: 'Type', select: { does_not_equal: ['A', 'B'] } })).toEqual(
        {
          and: [
            { property: 'Type', select: { does_not_equal: 'A' } },
            { property: 'Type', select: { does_not_equal: 'B' } },
          ],
        },
      );
    });

    it('passes through scalar selects unchanged', () => {
      const node = { property: 'Type', select: { equals: 'A' } };
      expect(translateFilter(node)).toEqual(node);
    });
  });

  describe('boolean groups', () => {
    it('recurses into and/or children', () => {
      expect(
        translateFilter({
          or: [{ property: 'X', checkbox: { equals: true } }],
        }),
      ).toEqual({ or: [{ property: 'X', checkbox: { equals: true } }] });
    });

    it('flattens a nested group introduced by an array select back into its parent', () => {
      // The array does_not_equal expands to an { and: [...] }, which must be
      // merged into the surrounding { and: [...] } (Notion's 2-level limit).
      expect(
        translateFilter({
          and: [
            { property: 'Type', select: { does_not_equal: ['A', 'B'] } },
            { property: 'Archived', checkbox: { equals: false } },
          ],
        }),
      ).toEqual({
        and: [
          { property: 'Type', select: { does_not_equal: 'A' } },
          { property: 'Type', select: { does_not_equal: 'B' } },
          { property: 'Archived', checkbox: { equals: false } },
        ],
      });
    });
  });
});
