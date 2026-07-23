import type {
  Note,
  NotionPageMarkdown,
  NotionPageObject,
  Project,
  Tag,
  Task,
} from '@notion-ub/contracts';
import { getTenantHeader } from './tenant-config';

/**
 * API client for the GlassTask backend server.
 *
 * In development, Vite proxies /api/* to the backend (localhost:3210).
 * In production, VITE_API_BASE is baked in at build time to point at the
 * deployed Lambda Function URL (see terraform/outputs.tf).
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * fetch() wrapper that attaches the current tenant's Notion config header,
 * throws on non-2xx responses, and parses the JSON body — narrowed to
 * `resultKey` when given (e.g. `{ tasks: [...] }` -> the `tasks` array).
 */
async function request<T>(path: string, init: RequestInit = {}, resultKey?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, 'X-Notion-Config': getTenantHeader() },
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  return resultKey ? data[resultKey] : data;
}

/** One page of a Notion-backed list view — see _shared/pagination.ts's fetchAllPages. */
export interface PagedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Like `request()`, but for a list-view endpoint that returns
 * `{ [resultKey]: T[], hasMore, nextCursor }`. Appends `?cursor=...` when
 * resuming a query past its first page.
 */
async function requestPage<T>(
  path: string,
  resultKey: string,
  cursor?: string,
): Promise<PagedResult<T>> {
  const url = cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
  const data = await request<Record<string, unknown>>(url);
  return {
    items: data[resultKey] as T[],
    hasMore: data.hasMore as boolean,
    nextCursor: data.nextCursor as string | null,
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchInboxTasks(cursor?: string): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/inbox', 'tasks', cursor);
}

export function fetchTodayTasks(cursor?: string): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/today', 'tasks', cursor);
}

export function fetchNext7DaysTasks(cursor?: string): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/next-7-days', 'tasks', cursor);
}

export function fetchTomorrowTasks(cursor?: string): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/tomorrow', 'tasks', cursor);
}

export function createTask(name: string): Promise<{ id: string; name: string }> {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function markTaskDone(id: string): Promise<void> {
  await request(`/api/tasks/${id}/done`, { method: 'PATCH' });
}

export function fetchProjectTasksTodo(
  projectId: string,
  cursor?: string,
): Promise<PagedResult<Task>> {
  return requestPage(`/api/tasks/for-project/${projectId}/todo`, 'tasks', cursor);
}

export function fetchProjectTasksDone(
  projectId: string,
  cursor?: string,
): Promise<PagedResult<Task>> {
  return requestPage(`/api/tasks/for-project/${projectId}/done`, 'tasks', cursor);
}

// ---------------------------------------------------------------------------
// Pages — generic over tasks, notes and projects, so the reader, the
// metadata screens, and delete all share these regardless of which kind of
// item the user is looking at.
// ---------------------------------------------------------------------------

export interface PageMetadata {
  project: string | null;
  due: string | null;
}

/**
 * A page's Project (resolved name) and Due date. Every kind of page carries a
 * Project relation; only tasks carry Due — for anything else `due` just comes
 * back null, and it's up to the caller whether to show it.
 */
export function fetchPageMetadata(id: string): Promise<PageMetadata> {
  return request(`/api/pages/${id}/metadata`);
}

/** Moves a page (task, note, or anything else) to the Notion Bin. */
export async function deletePage(id: string): Promise<void> {
  await request(`/api/pages/${id}`, { method: 'DELETE' });
}

/**
 * A page's body as Notion's own enhanced markdown — untouched. Turning it
 * into display text is the reader's job (see glasses/content/markdown-to-pages.ts).
 */
export function fetchPageMarkdown(id: string): Promise<NotionPageMarkdown> {
  return request(`/api/pages/${id}/markdown`);
}

/**
 * A page object. The reader's only use for it is the Description property —
 * markdown covers a page's body, and many Ultimate Brain tasks keep their
 * text in this property instead, with no body content at all.
 */
export function fetchPage(id: string): Promise<NotionPageObject> {
  return request(`/api/pages/${id}`);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function fetchInboxNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/inbox', 'notes', cursor);
}

export function fetchFavoriteNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/favorites', 'notes', cursor);
}

export function fetchByTagNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/by-tag', 'notes', cursor);
}

export function fetchNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/notes', 'notes', cursor);
}

export function fetchMeetingNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/meetings', 'notes', cursor);
}

export function fetchByProjectNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/by-project', 'notes', cursor);
}

export function fetchClipsNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/clips', 'notes', cursor);
}

export function fetchVoiceNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/voice', 'notes', cursor);
}

export function fetchJournalNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/journal', 'notes', cursor);
}

export function fetchAllNotes(cursor?: string): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/all', 'notes', cursor);
}

export function fetchNotesForProject(
  projectId: string,
  cursor?: string,
): Promise<PagedResult<Note>> {
  return requestPage(`/api/notes/for-project/${projectId}`, 'notes', cursor);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function fetchDoingProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/doing', 'projects', cursor);
}

export function fetchOngoingProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/ongoing', 'projects', cursor);
}

export function fetchOnHoldProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/on-hold', 'projects', cursor);
}

export function fetchDoneProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/done', 'projects', cursor);
}

export function fetchPlannedProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/planned', 'projects', cursor);
}

export function fetchBoardProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/board', 'projects', cursor);
}

export function fetchArchivedProjects(cursor?: string): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/archived', 'projects', cursor);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function fetchRecentTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/recent', 'tags', cursor);
}

export function fetchFavoriteTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/favorites', 'tags', cursor);
}

export function fetchAToZTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/a-z', 'tags', cursor);
}

export function fetchAreaTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/area', 'tags', cursor);
}

export function fetchResourceTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/resource', 'tags', cursor);
}

export function fetchEntityTags(cursor?: string): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/entity', 'tags', cursor);
}

export function fetchNotesForTag(tagId: string, cursor?: string): Promise<PagedResult<Note>> {
  return requestPage(`/api/notes/for-tag/${tagId}`, 'notes', cursor);
}
