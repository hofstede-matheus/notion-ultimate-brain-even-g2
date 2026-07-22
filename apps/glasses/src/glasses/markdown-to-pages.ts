/**
 * Notion markdown → the text the G2 reader displays.
 *
 * The server only fetches (GET /api/pages/:id/markdown proxies Notion's own
 * markdown export of a page's body, untouched); everything about what that
 * markdown *means* is decided here.
 *
 * Notion's export is "enhanced" markdown: mostly CommonMark, but block types
 * with no direct markdown equivalent — callouts, toggles, tables, linked
 * databases, child pages, meeting-note transcripts — arrive as a handful of
 * custom HTML-like tags mixed in with the prose. Every construct this parser
 * handles was confirmed by fetching real markdown for ~100 pages across this
 * workspace's Tasks/Notes/Projects/Wiki/Content databases and reading the
 * raw output; the shapes are documented next to the code that handles them.
 * Genuinely unrecognised markup — a future Notion export tag, or content
 * this workspace never happened to contain — is stripped defensively rather
 * than left to leak onto the display or throw.
 *
 * CommonMark's own markup (`#`/`##`/`###`, `- `, `1. `, `- [ ]`/`- [x]`,
 * `> `, `---`, fenced code) already *is* the exact display syntax this reader
 * wants, so most of it passes straight through unchanged — the real work is
 * stripping what the G2's single monochrome font can't render (bold, italic,
 * inline code, images) and converting the custom tags to equivalent lines.
 */

import { cleanForG2 } from 'even-toolkit/text-clean';
import { READER_CHARS_PER_LINE, READER_INDENT, READER_LINES_PER_PAGE } from './constants';

/** Indent levels past this render flat — deeper nesting would leave no room for text. */
const MAX_INDENT_LEVELS = 3;

/** Longest a link target may run before it's elided, in characters. */
const MAX_URL_CHARS = 40;

/**
 * Links back into Notion itself. The label already carries whatever the link
 * pointed at — a page title, a database view's name — so the target adds
 * nothing worth a line of screen space. Two forms observed: relative
 * (`[Projects](/1f63c6e7…?pvs=25)`, from ordinary `[label](url)` markdown
 * links) and absolute (`https://app.notion.com/p/…`, from the `url=` on the
 * <page>/<database>/<mention-page> tags below).
 */
const NOTION_LINK = /^(\/|https?:\/\/([\w-]+\.)*notion\.(so|com)\/)/;

/** Strips the protocol and caps a URL so one link can't swallow a whole page. */
function shortUrl(url: string): string {
  const bare = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '');
  return bare.length > MAX_URL_CHARS ? `${bare.slice(0, MAX_URL_CHARS - 1)}…` : bare;
}

/**
 * Strips glyphs the G2 font can't render (emoji, smart punctuation) — the
 * firmware silently drops them, so text measured before cleaning would wrap
 * wrong. Also collapses runs of whitespace, which is why every helper below
 * runs it on extracted text before that text is placed back into a line.
 */
function clean(text: string): string {
  return cleanForG2(text);
}

// ---------------------------------------------------------------------------
// Fenced code — protected from every other pass below. A code sample that
// happens to contain "**bold**" or "<callout>"-looking text must render
// verbatim, not get mangled by the markdown/tag stripping meant for prose.
// ---------------------------------------------------------------------------

interface Segment {
  kind: 'prose' | 'code';
  text: string;
  language?: string;
}

/** Splits raw markdown into alternating prose and fenced-code-block segments. */
function splitCodeFences(markdown: string): Segment[] {
  const fence = /```([a-z0-9+#]*)\n([\s\S]*?)```\n?/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of markdown.matchAll(fence)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ kind: 'prose', text: markdown.slice(lastIndex, index) });
    segments.push({ kind: 'code', text: match[2] ?? '', language: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < markdown.length)
    segments.push({ kind: 'prose', text: markdown.slice(lastIndex) });
  return segments;
}

// ---------------------------------------------------------------------------
// Tables — Notion's markdown export renders a table as HTML, not pipes:
//   <table header-row="true">
//   <tr>
//   <td>Exame</td><td>Resultado</td>
//   </tr>
//   ...
//   </table>
// (confirmed against a 49-row table in this workspace). Converted to one
// pipe-joined line per row before any other tag-stripping touches <td>/<tr>.
// ---------------------------------------------------------------------------

function convertTables(markdown: string): string {
  return markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_table, body: string) => {
    const rows: string[] = [];
    for (const rowMatch of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...(rowMatch[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
        (cellMatch) => (cellMatch[1] ?? '').replace(/\s+/g, ' ').trim(),
      );
      // Trailing empty cells are common (a half-filled row) and would each
      // leave a dangling separator.
      while (cells.length > 0 && !cells[cells.length - 1]) cells.pop();
      rows.push(cells.join(' | '));
    }
    // No leading/trailing newline: <table>/</table> already sit on their own
    // line in every observed export, so the surrounding text's own newlines
    // already separate this from whatever comes before/after — adding more
    // here would double up into a spurious blank line.
    return rows.join('\n');
  });
}

// ---------------------------------------------------------------------------
// Custom export tags. Each was found by fetching real markdown across this
// workspace and reading the raw output — see the comment above each rule for
// the exact shape it was confirmed against.
// ---------------------------------------------------------------------------

function convertTags(markdown: string): string {
  let text = markdown;

  // Tags in this first group are removed with NO replacement text — nested
  // ones (e.g. <notes> one level inside <meeting-notes>) sit on a
  // tab-indented line of their own, and that leading whitespace has to go
  // with them: consuming only the tag and its trailing newline leaves the
  // indent orphaned, and it then attaches itself to whatever real content
  // follows, indenting it one level for no reason (caught the hard way: a
  // page's "**Notes**" subheading was rendering one level indented, solely
  // because the <notes> wrapper two lines above it had a leading tab).

  // <file src="file://%7B...%7D"></file> — an attachment; the source is a
  // URL-encoded JSON blob, not a filename worth showing. Dropped along with
  // its content, same as an image.
  text = text.replace(/[ \t]*<file[^>]*>[\s\S]*?<\/file>\n?/g, '');
  text = text.replace(/[ \t]*<file[^>]*\/>\n?/g, '');

  // <transcript>\n\tTranscript omitted. Use the view tool with the meeting
  // note url (...) to view this transcript.\n</transcript> — the placeholder
  // Notion substitutes for a meeting recording's transcript (the reader never
  // requests the real one via include_transcript). It's agent-facing
  // boilerplate with a raw URL, not useful to a human reading on the
  // glasses — dropped along with its content.
  text = text.replace(/[ \t]*<transcript[^>]*>[\s\S]*?<\/transcript>\n?/g, '');

  // <table_of_contents color="gray"/> — no text of its own.
  text = text
    .replace(/[ \t]*<table_of_contents[^>]*\/>\n?/g, '')
    .replace(/[ \t]*<table_of_contents[^>]*>\n?/g, '')
    .replace(/[ \t]*<\/table_of_contents>\n?/g, '');

  // ![alt](url) — an image. Per spec, ignored like every other attachment.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // <empty-block/> — Notion's explicit "blank paragraph" marker, used for
  // deliberate spacing between blocks. Its trailing newline is deliberately
  // NOT consumed (unlike the tags above): removing just the tag leaves an
  // empty line, which the blank-collapsing in pushLine (below) turns into
  // exactly one separator line — any leftover leading tabs on that now-empty
  // line are harmless, since a blank line carries no indent.
  text = text.replace(/<empty-block\s*\/>/g, '');

  // <mention-date start="2026-06-23"/> — an inline date mention; unlike a
  // page mention (below) the value itself IS the text, so it's substituted
  // in place rather than dropped.
  text = text.replace(/<mention-date\s+start="([^"]*)"[^>]*\/>/g, '$1');

  // <mention-page url="https://app.notion.com/p/…"/> — an inline reference to
  // another page. Unlike the block API (which resolves a mention's title
  // server-side into rich_text), the markdown export emits this with no
  // label at all — confirmed against two real occurrences, both with zero
  // surrounding text. There's no title to show without another round trip
  // per mention, so it's dropped; the same applies to any other self-closing
  // <mention-*> tag (e.g. a person or database mention) this workspace
  // didn't happen to produce an example of.
  text = text.replace(/<mention-[a-z]+[^>]*\/>/g, '');

  // Every substitution below emits its marker text with no added newlines —
  // <callout>/<summary>/<database>/<page>/<unknown> all sit on their own
  // line in every real export this parser was checked against, so the
  // surrounding text's own newlines already separate the result from
  // whatever comes before/after. Wrapping the replacement in \n…\n as well
  // would double up into a spurious blank line (confirmed the hard way: an
  // earlier version of this parser did exactly that).

  // <callout>\n\ttext\n</callout> — flattened to one line; real callouts in
  // this workspace are simple text containers, not nested structure.
  text = text.replace(
    /<callout[^>]*>([\s\S]*?)<\/callout>/g,
    (_m, inner: string) => `! ${inner.replace(/\s+/g, ' ').trim()}`,
  );

  // <details>\n<summary>label</summary>\n\tbody\n</details> — a toggle.
  // HTML's own collapsible-section idiom, standing in for Notion's toggle
  // block. The summary becomes the toggle's marker line; the wrapper tags
  // are dropped along with one adjacent newline each (they always sit alone
  // on their own line, so removing tag-plus-newline deletes that whole line
  // rather than leaving it empty) — the body, whatever sits between
  // </summary> and </details>, is left in place for the rest of this
  // pipeline to process normally (its own nesting depth is not preserved:
  // every <details> body observed here was trivial, just a
  // <table_of_contents/>, so depth-tracking through a regex substitution
  // wasn't worth the complexity it would add).
  text = text.replace(
    /<summary>([\s\S]*?)<\/summary>/g,
    (_m, inner: string) => `+ ${inner.replace(/\s+/g, ' ').trim()}`,
  );
  text = text.replace(/[ \t]*<\/?details[^>]*>\n?/g, '');

  // <columns>/<column ratio="50"> — layout only; their content is ordinary
  // markdown and flows through unchanged once the wrapper tags (and the
  // whitespace/newline each always owns) are gone.
  text = text.replace(/[ \t]*<\/?columns?[^>]*>\n?/g, '');

  // <meeting-notes readOnlyViewMeetingNoteUrl="…"><notes>…</notes></meeting-notes>
  // — wraps a meeting page's recap text; same treatment as columns.
  text = text.replace(/[ \t]*<\/?(meeting-notes|notes)[^>]*>\n?/g, '');

  // <database url="…" icon="…">View: Tasks</database> — a linked database
  // view. Sometimes carries a visible label ("View: Tasks"), sometimes not
  // (<database url="…" inline="true"></database>) — both observed.
  text = text.replace(/<database[^>]*>([\s\S]*?)<\/database>/g, (_m, inner: string) => {
    const label = inner.replace(/\s+/g, ' ').trim();
    return label ? `[DB] ${label}` : '[DB]';
  });

  // <page url="https://app.notion.com/p/…">Title</page> — a child page,
  // linked (not embedded) — its own content belongs to that page, not this
  // one, same as the old block API's child_page.
  text = text.replace(
    /<page[^>]*>([\s\S]*?)<\/page>/g,
    (_m, inner: string) => `[Page] ${inner.replace(/\s+/g, ' ').trim()}`,
  );

  // <unknown url="…" alt="…"/> — Notion's own fallback for content the
  // exporter couldn't render as markdown: per the API docs, this covers
  // truncated subtrees, permission-denied blocks, and specifically
  // bookmark/embed/link_preview blocks (none appeared in this workspace's
  // sample, but the docs are explicit that they render this way). The url is
  // the one thing worth keeping — rendered the same way a bookmark was under
  // the old block-based parser.
  text = text.replace(
    /<unknown\s+[^>]*url="([^"]*)"[^>]*\/?>(?:[\s\S]*?<\/unknown>)?/g,
    (_m, url: string) => (url ? `[Link] ${shortUrl(url)}` : ''),
  );

  // <span color="…">text</span> — an inline colour highlight, sitting
  // mid-sentence rather than on its own line, so no adjacent newline to
  // consume here; the G2 is monochrome, so only the text survives.
  text = text.replace(/<\/?span[^>]*>/g, '');

  // Trailing block-color attribute, e.g. `## Section {color="green_bg"}` —
  // Notion's markdown way of encoding a block's background/text color has no
  // monochrome-display equivalent.
  text = text.replace(/\s*\{color="[^"]*"\}/g, '');

  // Safety net: any tag this parser doesn't specifically know about — a
  // future Notion export addition, or a construct this workspace never
  // happened to produce. Stripping just the tag markers (not their content)
  // is the safer default for a text format: an unwanted wrapper this parser
  // already knows about (file/image/transcript) has already been removed
  // above with its content; anything left is far more likely to be
  // additional inline markup than a media blob.
  text = text.replace(/<\/?[a-z][a-z0-9_-]*(?:\s[^>]*)?>/gi, '');

  return text;
}

// ---------------------------------------------------------------------------
// Inline formatting — the G2 has one font, no bold/italic/strikethrough, so
// these are stripped rather than rendered. Order matters: bold (**) must be
// stripped before italic (*) or a bold run's outer asterisks would be read
// as two mismatched italics; both must run before link processing, since a
// link's label can itself be formatted (`[**mediato.dev**](url)`, observed).
// ---------------------------------------------------------------------------

function stripInlineFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * [label](url) — appends the target when it adds information, matching the
 * old block-parser's link handling. A bare URL is already its own label, and
 * a link back into Notion (relative, or the absolute app.notion.com form)
 * says nothing the label doesn't.
 */
function convertLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, label: string, url: string) => {
    if (!url || url === label || NOTION_LINK.test(url)) return label;
    return `${label} (${shortUrl(url)})`;
  });
}

/**
 * CommonMark backslash-escapes any ASCII punctuation character that could
 * otherwise be read as markdown syntax (Notion's export does this for
 * literal `~`, `$`, `|`, `[`, `]`, `<`, confirmed across this workspace) —
 * undone last so no earlier structural pass mistakes an escaped character
 * for real markup.
 */
function unescapeMarkdown(text: string): string {
  return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, '$1');
}

// ---------------------------------------------------------------------------
// Line assembly — word-wrap, indent, and blank-line collapsing. Unchanged in
// spirit from the block-based parser: the G2's proportional font and fixed
// page budget don't care where the text came from.
// ---------------------------------------------------------------------------

/**
 * Word-wraps one logical line to `maxChars`. The first line carries `indent`,
 * continuations carry `indent` plus a hanging two spaces so a wrapped bullet
 * stays visually attached to its marker. A word too long for a line is split.
 */
function wrapLine(text: string, indent: string, maxChars: number): string[] {
  const continuation = `${indent}  `;
  const lines: string[] = [];
  let prefix = indent;
  let current = '';

  const flush = (): void => {
    lines.push(prefix + current);
    prefix = continuation;
    current = '';
  };

  for (const word of text.split(' ')) {
    if (!word) continue;

    const candidate = current ? `${current} ${word}` : word;
    if (prefix.length + candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) flush();

    let rest = word;
    // Hard-split a word that can't fit a line of its own (a long URL).
    while (prefix.length + rest.length > maxChars && prefix.length < maxChars) {
      current = rest.slice(0, maxChars - prefix.length);
      rest = rest.slice(maxChars - prefix.length);
      flush();
    }
    current = rest;
  }

  if (current) lines.push(prefix + current);
  return lines;
}

/**
 * Appends a rendered line, collapsing runs of blanks. Notion's <empty-block/>
 * spacer is common enough that emitting each one verbatim would leave pages
 * half empty.
 */
function pushLine(out: string[], line: string, indent: string, charsPerLine: number): void {
  if (!line) {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    return;
  }
  out.push(...wrapLine(line, indent, charsPerLine));
}

/** One markdown segment (already tag/formatting-processed) → its raw text lines. */
function segmentLines(segment: Segment): string[] {
  if (segment.kind === 'code') {
    const body = segment.text.replace(/\n$/, '').split('\n');
    return [`\`\`\`${segment.language ?? ''}`, ...body, '```'];
  }

  let text = convertTables(segment.text);
  text = convertTags(text);
  text = stripInlineFormatting(text);
  text = convertLinks(text);
  text = unescapeMarkdown(text);
  return text.split('\n');
}

/**
 * Notion tab-indents a nested block's markdown by one `\t` per level (a
 * bullet under a toggle, a paragraph under a column — confirmed against
 * multi-level nested lists in this workspace). Returns the depth and the
 * line with those tabs removed.
 */
function splitIndent(line: string): { depth: number; text: string } {
  let depth = 0;
  while (line[depth] === '\t') depth++;
  return { depth, text: line.slice(depth) };
}

/** Page markdown → wrapped display lines, in reading order. */
export function markdownToLines(
  markdown: string,
  charsPerLine: number = READER_CHARS_PER_LINE,
): string[] {
  const out: string[] = [];

  for (const segment of splitCodeFences(markdown)) {
    for (const raw of segmentLines(segment)) {
      const { depth, text } = splitIndent(raw);
      const indent = READER_INDENT.repeat(Math.min(depth, MAX_INDENT_LEVELS));
      pushLine(out, clean(text), indent, charsPerLine);
    }
  }

  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out;
}

/**
 * Groups lines into screenfuls. A page never opens on a blank line: that
 * would both waste one of very few lines and, at the end of a document, leave
 * a trailing blank that pushes the page past the container height — which
 * re-arms the firmware's internal scroll and breaks the page-turn gestures.
 */
export function paginateLines(
  lines: string[],
  linesPerPage: number = READER_LINES_PER_PAGE,
): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (current.length === 0 && line === '') continue;
    current.push(line);
    if (current.length === linesPerPage) {
      pages.push(current);
      current = [];
    }
  }
  if (current.length > 0) pages.push(current);

  return pages;
}

/** Page markdown → ready-to-render pages of display lines. */
export function markdownToPages(markdown: string): string[][] {
  return paginateLines(markdownToLines(markdown));
}
