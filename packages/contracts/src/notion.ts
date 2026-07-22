/**
 * The two Notion REST responses the page reader proxies through untouched:
 * a page's body as Notion's own enhanced markdown (GET /api/pages/:id/markdown),
 * and the page object (GET /api/pages/:id), needed only because markdown
 * covers a page's *body* — for the many Ultimate Brain tasks whose text lives
 * in a Description property instead (their body has no content at all), the
 * reader falls back to reading that property directly. Both shapes are
 * consumed and turned into display text entirely in the glasses app (see
 * apps/glasses/src/page-loader.ts and glasses/markdown-to-pages.ts) — the server
 * does no parsing.
 */

export interface NotionPageMarkdown {
  object?: string;
  id?: string;
  /** The page's body, as Notion's enhanced markdown (HTML-flavoured tags mixed with CommonMark). */
  markdown?: string;
  /** True if the body exceeded Notion's block limit (~20,000) and was cut short. */
  truncated?: boolean;
  /** Block ids Notion couldn't resolve into markdown; empty in practice for this workspace. */
  unknown_block_ids?: string[];
}

export interface NotionPageObject {
  id?: string;
  properties?: Record<string, { rich_text?: { plain_text?: string }[] } | undefined>;
}
