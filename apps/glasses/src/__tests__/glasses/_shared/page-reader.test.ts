/**
 * The Notion page reader (openPage/turnPage) — reached from a task's or a
 * note's action menu via ctx.openPage.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageMarkdown } from '../../../api';
import { mount } from '../harness';

describe('openPage', () => {
  it('loads the markdown, paginates it, and lands on page-content', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: 'Hello world', truncated: false });
    const h = mount();
    h.state.screen = 'task-actions';

    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();

    expect(h.state.screen).toBe('page-content');
    expect(h.state.pageContent).toMatchObject({
      loading: false,
      title: 'My Task',
      returnTo: 'task-actions',
    });
    expect(h.state.pageContent?.pages).toEqual([['Hello world']]);
  });

  it('shows a loading state before the fetch resolves', async () => {
    vi.mocked(fetchPageMarkdown).mockReturnValue(new Promise(() => {}));
    const h = mount();

    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();

    expect(h.state.pageContent?.loading).toBe(true);
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain('Loading');
  });

  it('appends the truncated notice as a final page', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: 'Hello world', truncated: true });
    const h = mount();

    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();

    const pages = h.state.pageContent?.pages ?? [];
    expect(pages.at(-1)).toEqual(['Page truncated by Notion.']);
  });

  it('shows the error message when the fetch fails', async () => {
    vi.mocked(fetchPageMarkdown).mockRejectedValue(new Error('offline'));
    const h = mount();

    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();

    expect(h.state.pageContent?.error).toBe('offline');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') expect(display.content).toContain('offline');
  });
});

describe('turnPage', () => {
  async function openMultiPage(h: ReturnType<typeof mount>) {
    const markdown = Array.from({ length: 16 }, (_, i) => `line ${i}`).join('\n');
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown, truncated: false });
    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();
  }

  it('advances and goes back within bounds', async () => {
    const h = mount();
    await openMultiPage(h);
    expect(h.state.pageContent?.pages).toHaveLength(2);
    expect(h.state.pageContent?.index).toBe(0);

    h.ctx.turnPage(1);
    expect(h.state.pageContent?.index).toBe(1);

    h.ctx.turnPage(-1);
    expect(h.state.pageContent?.index).toBe(0);
  });

  it('clamps at both ends', async () => {
    const h = mount();
    await openMultiPage(h);

    h.ctx.turnPage(-1);
    expect(h.state.pageContent?.index).toBe(0);

    h.ctx.turnPage(1);
    h.ctx.turnPage(1); // already on the last page (index 1) — no-op
    expect(h.state.pageContent?.index).toBe(1);
  });

  it('is a no-op while loading', async () => {
    vi.mocked(fetchPageMarkdown).mockReturnValue(new Promise(() => {}));
    const h = mount();
    h.ctx.openPage('p1', 'My Task', 'task-actions');
    await h.settle();
    expect(h.state.pageContent?.loading).toBe(true);

    h.ctx.turnPage(1);

    expect(h.state.pageContent?.index).toBe(0);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
