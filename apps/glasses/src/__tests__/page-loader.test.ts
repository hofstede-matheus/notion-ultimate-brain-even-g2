/**
 * Reading a Notion page's content.
 *
 * The server forwards two Notion calls untouched — a page's markdown body,
 * and (for the Description-property fallback) the page object — so what's
 * tested here is purely the fallback decision: use the markdown when there
 * is one, fall back to Description when there isn't.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchPageMarkdown: vi.fn(),
  fetchPage: vi.fn(),
}));

import { fetchPage, fetchPageMarkdown } from '../api';
import { loadPageContent } from '../page-loader';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadPageContent', () => {
  it('returns the markdown body when the page has one', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({
      markdown: '# Heading\nSome text',
      truncated: false,
    });

    const content = await loadPageContent('p1');

    expect(content).toEqual({ markdown: '# Heading\nSome text', truncated: false });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('passes through a true truncated flag', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: 'Some text', truncated: true });

    const content = await loadPageContent('p1');

    expect(content.truncated).toBe(true);
  });

  it("falls back to the page's Description property when the body is empty", async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: '', truncated: false });
    vi.mocked(fetchPage).mockResolvedValue({
      properties: { Description: { rich_text: [{ plain_text: 'Buy the milk' }] } },
    });

    const content = await loadPageContent('p1');

    expect(fetchPage).toHaveBeenCalledWith('p1');
    expect(content).toEqual({ markdown: 'Buy the milk', truncated: false });
  });

  it('falls back when the body is only whitespace', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: '  \n\n  ', truncated: false });
    vi.mocked(fetchPage).mockResolvedValue({
      properties: { Description: { rich_text: [{ plain_text: 'Buy the milk' }] } },
    });

    const content = await loadPageContent('p1');

    expect(content.markdown).toBe('Buy the milk');
  });

  it('concatenates every run of a multi-run Description', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: '', truncated: false });
    vi.mocked(fetchPage).mockResolvedValue({
      properties: {
        Description: {
          rich_text: [{ plain_text: 'Buy ' }, { plain_text: 'the ' }, { plain_text: 'milk' }],
        },
      },
    });

    const content = await loadPageContent('p1');

    expect(content.markdown).toBe('Buy the milk');
  });

  it('returns nothing for a page with no body and no Description', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: '', truncated: false });
    vi.mocked(fetchPage).mockResolvedValue({ properties: {} });

    const content = await loadPageContent('p1');

    expect(content).toEqual({ markdown: '', truncated: false });
  });
});
