/**
 * Notion markdown -> reader text.
 *
 * Every construct exercised here was confirmed against real markdown fetched
 * from this workspace (see the comments in glasses/content/markdown-to-pages.ts for exactly
 * which page each shape came from) — these tests pin that exact syntax, not
 * a guess at what Notion's export "should" look like.
 *
 * Alongside the per-construct behaviour, every page must fit its text
 * container with zero overflow, so these tests also pin the two invariants
 * the display depends on: no line wider than READER_CHARS_PER_LINE, and no
 * page longer than READER_LINES_PER_PAGE.
 */

import { describe, expect, it } from 'vitest';
import { READER_CHARS_PER_LINE, READER_LINES_PER_PAGE } from '../../glasses/constants';
import { markdownToLines, markdownToPages, paginateLines } from '../../glasses/content/markdown-to-pages';

describe('CommonMark passes through unchanged', () => {
  it('headings, bullets, numbered lists, to-dos, quotes and dividers already are the display syntax', () => {
    const markdown = [
      '# Title',
      '## Section',
      '### Sub-section',
      '- a bullet',
      '1. first',
      '2. second',
      '- [ ] open',
      '- [x] done',
      '> a quote',
      '---',
    ].join('\n');

    expect(markdownToLines(markdown)).toEqual([
      '# Title',
      '## Section',
      '### Sub-section',
      '- a bullet',
      '1. first',
      '2. second',
      '- [ ] open',
      '- [x] done',
      '> a quote',
      '---',
    ]);
  });

  it("numbers stay exactly as Notion's export sequenced them — no re-numbering needed", () => {
    // Confirmed against a real numbered list: Notion's markdown already
    // carries the correct sequential numbers, unlike the block API (whose
    // items arrive unordered and had to be counted by the old parser).
    expect(markdownToLines('5. fifth\n6. sixth')).toEqual(['5. fifth', '6. sixth']);
  });
});

describe('inline formatting is stripped — the G2 has one font', () => {
  it('unwraps bold, italic, inline code and strikethrough', () => {
    expect(markdownToLines('**Install Homebrew**: a package manager')).toEqual([
      'Install Homebrew: a package manager',
    ]);
    expect(markdownToLines('*Use an italic line*')).toEqual(['Use an italic line']);
    expect(markdownToLines('Run `cd` in Terminal')).toEqual(['Run cd in Terminal']);
    expect(markdownToLines('~~old plan~~')).toEqual(['old plan']);
  });

  it('strips formatting inside a link label too — observed as [**mediato.dev**](url)', () => {
    expect(markdownToLines('[**mediato.dev**](http://mediato.dev)')).toEqual([
      'mediato.dev (mediato.dev)',
    ]);
  });
});

describe('links', () => {
  it('appends a target the label does not already carry', () => {
    expect(markdownToLines('[the docs](https://example.com/guide)')).toEqual([
      'the docs (example.com/guide)',
    ]);
  });

  it('leaves bare URLs unannotated', () => {
    expect(markdownToLines('[https://x.dev](https://x.dev)')).toEqual(['https://x.dev']);
  });

  it('drops the target for a relative internal Notion link — [Projects](/1f63c…?pvs=25)', () => {
    expect(markdownToLines('[Projects](/1f63c6e7dd22810f8a29d196adea8cd4?pvs=25)')).toEqual([
      'Projects',
    ]);
  });

  it('handles a non-http scheme without crashing — slackUser://… observed in this workspace', () => {
    expect(markdownToLines('[@marina](slackUser://didomi.slack.com/U099LAWMZGW)')).toEqual([
      '@marina (didomi.slack.com/U099LAWMZGW)',
    ]);
  });
});

describe('images and attachments are ignored, per spec', () => {
  it('drops an image', () => {
    expect(markdownToLines('![](https://prod-files-secure.s3.amazonaws.com/x.png)')).toEqual([]);
  });

  it('drops a <file> attachment tag and its content', () => {
    const markdown = 'Before\n<file src="file://%7B%22source%22%3A%22x%22%7D"></file>\nAfter';
    expect(markdownToLines(markdown)).toEqual(['Before', 'After']);
  });
});

describe('tables — Notion exports HTML, not pipes', () => {
  it('converts <table>/<tr>/<td> to pipe-joined rows', () => {
    const markdown = [
      '<table header-row="true">',
      '<tr>',
      '<td>Exame</td>',
      '<td>Resultado</td>',
      '</tr>',
      '<tr>',
      '<td>Hemácias</td>',
      '<td>5,19</td>',
      '</tr>',
      '</table>',
    ].join('\n');

    expect(markdownToLines(markdown)).toEqual(['Exame | Resultado', 'Hemácias | 5,19']);
  });

  it('drops trailing empty cells — a status column of just an unrenderable glyph', () => {
    const markdown = '<table><tr><td>Iron</td><td>42</td><td></td></tr></table>';
    expect(markdownToLines(markdown)).toEqual(['Iron | 42']);
  });
});

describe('callouts and toggles', () => {
  it('flattens a <callout> to one marked line', () => {
    const markdown = '<callout>\n\tIn our company, we write scripts.\n</callout>';
    expect(markdownToLines(markdown)).toEqual(['! In our company, we write scripts.']);
  });

  it('turns <details><summary> into a toggle marker and keeps the body', () => {
    const markdown = '<details>\n<summary>**Nav**</summary>\n\tBody text\n</details>';
    // Body text is tab-indented one level in the source, same as any nested block.
    expect(markdownToLines(markdown)).toEqual(['+ Nav', '  Body text']);
  });
});

describe('linked/child pages and databases', () => {
  it('labels a <page> as [Page]', () => {
    expect(
      markdownToLines('<page url="https://app.notion.com/p/3353c6e7dd22">Research</page>'),
    ).toEqual(['[Page] Research']);
  });

  it('labels a <database> with its visible text', () => {
    expect(
      markdownToLines(
        '<database url="https://app.notion.com/p/x" icon="/i.svg">View: Tasks</database>',
      ),
    ).toEqual(['[DB] View: Tasks']);
  });

  it('labels an empty <database> with no visible text', () => {
    expect(
      markdownToLines('<database url="https://app.notion.com/p/x" inline="true"></database>'),
    ).toEqual(['[DB]']);
  });
});

describe('mentions', () => {
  it('substitutes a date mention inline', () => {
    expect(markdownToLines('Due <mention-date start="2026-06-23"/>')).toEqual(['Due 2026-06-23']);
  });

  it('drops a page mention — the markdown export gives it no title to show', () => {
    // cleanForG2 collapses the double space left behind where the tag was.
    expect(
      markdownToLines('See <mention-page url="https://app.notion.com/p/x"/> for details'),
    ).toEqual(['See for details']);
  });
});

describe('layout and grouping wrappers contribute no text of their own', () => {
  it('columns', () => {
    const markdown =
      '<columns>\n<column ratio="50">\nLeft\n</column>\n<column ratio="50">\nRight\n</column>\n</columns>';
    expect(markdownToLines(markdown)).toEqual(['Left', 'Right']);
  });

  it('meeting-notes/notes', () => {
    const markdown =
      '<meeting-notes readOnlyViewMeetingNoteUrl="x">\n<notes>\nRecap text\n</notes>\n</meeting-notes>';
    expect(markdownToLines(markdown)).toEqual(['Recap text']);
  });

  it("does not leak a nested wrapper tag's own indent onto unrelated content that follows it", () => {
    // Regression: <notes> here sits one tab in, nested inside
    // <meeting-notes> — confirmed against a real page. Stripping the tag
    // without also consuming that leading tab left it dangling, and it then
    // attached itself to the next real line ("**Notes**"), indenting a
    // top-level heading one level for no reason.
    const markdown =
      '<meeting-notes url="x">\n\t<notes>\n\t\t<empty-block/>\n\t</notes>\n</meeting-notes>\n**Notes**\n- a bullet';
    expect(markdownToLines(markdown)).toEqual(['Notes', '- a bullet']);
  });

  it('an inline color span keeps its text, drops the tag', () => {
    expect(markdownToLines('Highlighted in <span color="green_bg">green</span>.')).toEqual([
      'Highlighted in green.',
    ]);
  });
});

describe('dropped without a trace', () => {
  it('a meeting transcript placeholder — agent-facing boilerplate, not useful to a human reader', () => {
    const markdown =
      '<transcript>\n\tTranscript omitted. Use the view tool with the meeting note url (x) to view this transcript.\n</transcript>';
    expect(markdownToLines(markdown)).toEqual([]);
  });

  it('a table of contents', () => {
    expect(markdownToLines('<table_of_contents color="gray"/>')).toEqual([]);
  });
});

describe('unknown content', () => {
  it('renders a <unknown> tag with a url as a link', () => {
    expect(markdownToLines('<unknown url="https://example.com/thing" alt="a bookmark"/>')).toEqual([
      '[Link] example.com/thing',
    ]);
  });

  it('strips a tag this parser has never seen, keeping its text — the safety net for future export additions', () => {
    expect(markdownToLines('<some-future-tag>plain text</some-future-tag>')).toEqual([
      'plain text',
    ]);
  });
});

describe('block color attributes', () => {
  it('strips a trailing {color="…"} — no monochrome-display equivalent', () => {
    expect(markdownToLines('## Section {color="green_bg"}')).toEqual(['## Section']);
  });
});

describe('backslash-escaped characters', () => {
  it('unescapes literal punctuation Notion escapes so it is not read as markdown syntax', () => {
    expect(markdownToLines('\\[On-camera\\] and a \\$5 tip \\| \\~ \\< done')).toEqual([
      '[On-camera] and a $5 tip | ~ < done',
    ]);
  });
});

describe('fenced code — protected from every other pass', () => {
  it('fences a code block and preserves markdown-looking text inside it verbatim', () => {
    const markdown = '```markdown\n## Not a real heading\n**not bold either**\n```';
    expect(markdownToLines(markdown)).toEqual([
      '```markdown',
      '## Not a real heading',
      '**not bold either**',
      '```',
    ]);
  });

  it('carries the language tag through, and renders a bare fence with none', () => {
    expect(markdownToLines('```yaml\nkey: value\n```')).toEqual(['```yaml', 'key: value', '```']);
    expect(markdownToLines('```\nplain\n```')).toEqual(['```', 'plain', '```']);
  });

  it('does not let a <callout>-looking string inside code trigger the callout rule', () => {
    const markdown = '```\n<callout>literally this</callout>\n```';
    expect(markdownToLines(markdown)).toEqual(['```', '<callout>literally this</callout>', '```']);
  });
});

describe('nesting — Notion tab-indents a nested block by one \\t per level', () => {
  it('indents a bullet under a toggle', () => {
    const markdown = '<details>\n<summary>Toggle</summary>\n\t- nested bullet\n</details>';
    expect(markdownToLines(markdown)).toEqual(['+ Toggle', '  - nested bullet']);
  });

  it('supports multiple levels', () => {
    expect(markdownToLines('- top\n\t- one deep\n\t\t- two deep')).toEqual([
      '- top',
      '  - one deep',
      '    - two deep',
    ]);
  });
});

describe('blank lines', () => {
  it('collapses a run of <empty-block/> spacers to one blank separator', () => {
    const markdown = 'Before\n<empty-block/>\n<empty-block/>\nAfter';
    expect(markdownToLines(markdown)).toEqual(['Before', '', 'After']);
  });

  it('does not insert spacing Notion did not have — adjacent blocks stay adjacent', () => {
    // Confirmed against a real page: a paragraph followed directly by a
    // heading with no blank line between them in the raw markdown.
    expect(markdownToLines('Some intro text.\n# Action Steps')).toEqual([
      'Some intro text.',
      '# Action Steps',
    ]);
  });

  it('trims blank lines off the end of the document', () => {
    expect(markdownToLines('Only\n<empty-block/>')).toEqual(['Only']);
  });
});

describe('glyphs the G2 font cannot render', () => {
  it('strips emoji but keeps accented Latin', () => {
    expect(markdownToLines('Ship it 🚀 today')).toEqual(['Ship it today']);
    expect(markdownToLines('Hemácias e referência')).toEqual(['Hemácias e referência']);
  });
});

describe('wrapping', () => {
  it('never emits a line wider than the reader allows', () => {
    const long =
      'Converting video files to audio files can be useful when you want to extract the audio from a video.';

    for (const line of markdownToLines(long)) {
      expect(line.length).toBeLessThanOrEqual(READER_CHARS_PER_LINE);
    }
  });

  it('hangs continuations under their marker so a wrapped bullet stays attached', () => {
    const lines = markdownToLines('- A bullet long enough that it has to wrap onto a second line');

    expect(lines[0]).toBe('- A bullet long enough that it has to wrap');
    expect(lines[1]).toBe('  onto a second line');
  });

  it('hard-splits a word too long to fit a line of its own', () => {
    const url = 'a'.repeat(60);
    const lines = markdownToLines(url);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(READER_CHARS_PER_LINE);
    expect(lines.join('').replace(/\s/g, '')).toBe(url);
  });

  it('never puts a newline inside one rendered line, so a page renders the height it reports', () => {
    // The screen joins a page with '\n' and hands it to one text container —
    // a line hiding its own newline would render taller than it counts,
    // pushing the page past the container and re-arming the firmware scroll
    // that pagination exists to avoid. Every line here goes through the same
    // pushLine/wrapLine pipeline, so one representative multi-construct
    // document is enough to pin the invariant.
    const pages = markdownToPages(
      [
        '# Groceries',
        '- milk',
        '- eggs',
        '<table><tr><td>a</td><td>b</td></tr></table>',
        '```\nconst a = 1;\n```',
      ].join('\n'),
    );

    for (const page of pages) {
      expect(page.join('\n').split('\n')).toHaveLength(page.length);
    }
  });
});

describe('pagination', () => {
  it('fills pages to the line budget and never overruns it', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);

    const pages = paginateLines(lines);

    expect(pages).toHaveLength(Math.ceil(20 / READER_LINES_PER_PAGE));
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(READER_LINES_PER_PAGE);
    expect(pages.flat()).toEqual(lines);
  });

  it('never opens a page on a blank line — it would waste one of very few lines', () => {
    const lines = [...Array.from({ length: READER_LINES_PER_PAGE }, () => 'x'), '', 'tail'];

    const pages = paginateLines(lines);

    expect(pages[1]).toEqual(['tail']);
  });

  it('has no pages at all for an empty document', () => {
    expect(markdownToPages('')).toEqual([]);
  });
});
