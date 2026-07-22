/**
 * Reading a Notion page's body.
 *
 * The server forwards Notion's own markdown export of the page untouched
 * (GET /api/pages/:id/markdown) — turning that markdown into the reader's
 * display lines is glasses/content/markdown-to-pages.ts's job. Markdown only ever covers a
 * page's body, though: for the many Ultimate Brain tasks whose text lives in
 * a Description property instead (their body has no content at all — of 100
 * sampled tasks, 97 had none, while 55 had a non-empty Description), this
 * falls back to reading that property directly.
 */

import { fetchPage, fetchPageMarkdown } from './api';

/** A page's markdown body, or its title-less Description as a plain string. */
export interface PageContent {
  markdown: string;
  /** True if Notion cut the body short (~20,000-block ceiling) — shown as a note at the end of the reader. */
  truncated: boolean;
}

/** Concatenates a property's rich text runs into a plain string. */
function richTextToString(runs: { plain_text?: string }[] | undefined): string {
  return (runs ?? []).map((run) => run.plain_text ?? '').join('');
}

/**
 * A page's content, ready for the parser: its markdown body, or — when that
 * body is empty — its Description property instead.
 */
export async function loadPageContent(pageId: string): Promise<PageContent> {
  const { markdown, truncated } = await fetchPageMarkdown(pageId);
  if (markdown?.trim()) return { markdown, truncated: truncated ?? false };

  const page = await fetchPage(pageId);
  const description = richTextToString(page.properties?.Description?.rich_text);
  return { markdown: description, truncated: false };
}
