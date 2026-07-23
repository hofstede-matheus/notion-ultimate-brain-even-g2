/**
 * Tags menu's "Types" item opens a submenu of the tag types that actually
 * exist (Area/Resource/Entity); picking one lists tags of that type, and
 * tapping a tag from there drills into its notes like any other tag row.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchAreaTags, fetchEntityTags, fetchResourceTags } from '../../../api';
import { back, mount, select } from '../harness';

describe('Tags menu — Types', () => {
  it('opens the type submenu without fetching', () => {
    const h = mount();
    h.state.screen = 'tags-menu';

    h.dispatch(select(3)); // Types

    expect(h.state.screen).toBe('tag-types-menu');
    expect(fetchAreaTags).not.toHaveBeenCalled();
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Area', 'Resource', 'Entity'] });
  });

  it('GO_BACK from the type submenu returns to the tags menu', () => {
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3));

    h.dispatch(back());

    expect(h.state.screen).toBe('tags-menu');
  });

  it('Area fetches and shows the area-tagged tags', async () => {
    vi.mocked(fetchAreaTags).mockResolvedValue({
      items: [{ id: 'g1', name: 'Home' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3)); // -> tag-types-menu

    h.dispatch(select(0)); // Area
    await h.settle();

    expect(fetchAreaTags).toHaveBeenCalledWith(undefined);
    expect(h.state.screen).toBe('tags-types-area');
    expect(h.state.lists['tags-types-area']).toEqual([{ id: 'g1', name: 'Home' }]);
  });

  it('Resource fetches and shows the resource-tagged tags', async () => {
    vi.mocked(fetchResourceTags).mockResolvedValue({
      items: [{ id: 'g2', name: 'Programming' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3));

    h.dispatch(select(1)); // Resource
    await h.settle();

    expect(fetchResourceTags).toHaveBeenCalledWith(undefined);
    expect(h.state.screen).toBe('tags-types-resource');
    expect(h.state.lists['tags-types-resource']).toEqual([{ id: 'g2', name: 'Programming' }]);
  });

  it('Entity fetches and shows the entity-tagged tags', async () => {
    vi.mocked(fetchEntityTags).mockResolvedValue({
      items: [{ id: 'g3', name: 'Essays' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3));

    h.dispatch(select(2)); // Entity
    await h.settle();

    expect(fetchEntityTags).toHaveBeenCalledWith(undefined);
    expect(h.state.screen).toBe('tags-types-entity');
    expect(h.state.lists['tags-types-entity']).toEqual([{ id: 'g3', name: 'Essays' }]);
  });

  it('GO_BACK from a type-list screen returns to the type submenu', async () => {
    vi.mocked(fetchAreaTags).mockResolvedValue({
      items: [{ id: 'g1', name: 'Home' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3));
    h.dispatch(select(0)); // Area
    await h.settle();

    h.dispatch(back());

    expect(h.state.screen).toBe('tag-types-menu');
  });

  it('tapping a tag in a type-list screen opens its notes list', async () => {
    vi.mocked(fetchAreaTags).mockResolvedValue({
      items: [{ id: 'g1', name: 'Home' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'tags-menu';
    h.dispatch(select(3));
    h.dispatch(select(0)); // -> tags-types-area
    await h.settle();

    h.dispatch(select(0)); // tap the tag
    await h.settle();

    expect(h.state.selectedTag).toEqual({ id: 'g1', name: 'Home', returnTo: 'tags-types-area' });
    expect(h.state.screen).toBe('tag-notes');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
