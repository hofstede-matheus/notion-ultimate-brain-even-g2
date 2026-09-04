import type {
  Note,
  NotionPageMarkdown,
  NotionPageObject,
  Project,
  Tag,
  Task,
} from '@notion-ub/contracts';
import { fetchWithRetry, type RequestOptions } from './http/client';
import { getTenantHeader } from './tenant-config';

export type { RequestOptions } from './http/client';
export { ApiError } from './http/errors';

/** Bytes of a non-2xx response body captured in the trace log before throwing. */
const ERROR_BODY_PREVIEW_BYTES = 500;

/**
 * API client for the Ultimate Brain backend server.
 *
 * In development, Vite proxies /api/* to the backend (localhost:3210).
 * In production, VITE_API_BASE is baked in at build time to point at the
 * deployed Lambda Function URL (see terraform/outputs.tf).
 *
 * Retry (backoff, per-attempt timeout, method/status/code policy) lives in
 * ./http/client.ts and ./http/retry.ts — this file only builds the request and narrows the
 * response to `resultKey` when given.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(
  path: string,
  init: RequestInit = {},
  resultKey?: string,
  opts?: RequestOptions,
): Promise<T> {
  const data = await fetchWithRetry<Record<string, unknown> | T>(
    `${API_BASE}${path}`,
    {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        'X-Notion-Config': getTenantHeader(),
      },
    },
    { label: path, previewBytes: ERROR_BODY_PREVIEW_BYTES, ...opts },
  );
  return resultKey ? ((data as Record<string, unknown>)[resultKey] as T) : (data as T);
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
  opts?: RequestOptions,
): Promise<PagedResult<T>> {
  const url = cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
  const data = await request<Record<string, unknown>>(url, undefined, undefined, opts);
  return {
    items: data[resultKey] as T[],
    hasMore: data.hasMore as boolean,
    nextCursor: data.nextCursor as string | null,
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchInboxTasks(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/inbox', 'tasks', cursor, opts);
}

export function fetchTodayTasks(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/today', 'tasks', cursor, opts);
}

export function fetchNext7DaysTasks(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/next-7-days', 'tasks', cursor, opts);
}

export function fetchTomorrowTasks(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage('/api/tasks/tomorrow', 'tasks', cursor, opts);
}

export function createTask(
  name: string,
  opts?: RequestOptions,
): Promise<{ id: string; name: string }> {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify({ name }) }, undefined, opts);
}

export async function markTaskDone(id: string, opts?: RequestOptions): Promise<void> {
  await request(`/api/tasks/${id}/done`, { method: 'PATCH' }, undefined, opts);
}

/** Sets or clears (date=null) a task's due date. */
export async function setTaskDueDate(
  id: string,
  date?: string | null,
  opts?: RequestOptions,
): Promise<void> {
  await request(
    `/api/tasks/${id}/due`,
    { method: 'PATCH', body: JSON.stringify({ date: date ?? null }) },
    undefined,
    opts,
  );
}

/** Sets or clears (projectId=null) a page's Project relation. Generic over tasks and notes. */
export async function setPageProject(
  id: string,
  projectId: string | null,
  opts?: RequestOptions,
): Promise<void> {
  await request(
    `/api/pages/${id}/project`,
    { method: 'PATCH', body: JSON.stringify({ projectId }) },
    undefined,
    opts,
  );
}

export function fetchProjectTasksTodo(
  projectId: string,
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage(`/api/tasks/for-project/${projectId}/todo`, 'tasks', cursor, opts);
}

export function fetchProjectTasksDone(
  projectId: string,
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Task>> {
  return requestPage(`/api/tasks/for-project/${projectId}/done`, 'tasks', cursor, opts);
}

// ---------------------------------------------------------------------------
// Pages — generic over tasks, notes and projects, so the reader, the
// details screens, and delete all share these regardless of which kind of
// item the user is looking at.
// ---------------------------------------------------------------------------

export interface PageDetails {
  project: string | null;
  due: string | null;
}

/**
 * A page's Project (resolved name) and Due date. Every kind of page carries a
 * Project relation; only tasks carry Due — for anything else `due` just comes
 * back null, and it's up to the caller whether to show it.
 */
export function fetchPageDetails(id: string, opts?: RequestOptions): Promise<PageDetails> {
  return request(`/api/pages/${id}/details`, undefined, undefined, opts);
}

/** Moves a page (task, note, or anything else) to the Notion Bin. */
export async function deletePage(id: string, opts?: RequestOptions): Promise<void> {
  await request(`/api/pages/${id}`, { method: 'DELETE' }, undefined, opts);
}

/**
 * A page's body as Notion's own enhanced markdown — untouched. Turning it
 * into display text is the reader's job (see glasses/content/markdown-to-pages.ts).
 */
export function fetchPageMarkdown(id: string, opts?: RequestOptions): Promise<NotionPageMarkdown> {
  return request(`/api/pages/${id}/markdown`, undefined, undefined, opts);
}

/**
 * A page object. The reader's only use for it is the Description property —
 * markdown covers a page's body, and many Ultimate Brain tasks keep their
 * text in this property instead, with no body content at all.
 */
export function fetchPage(id: string, opts?: RequestOptions): Promise<NotionPageObject> {
  return request(`/api/pages/${id}`, undefined, undefined, opts);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function fetchInboxNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/inbox', 'notes', cursor, opts);
}

export function fetchFavoriteNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/favorites', 'notes', cursor, opts);
}

export function fetchByTagNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/by-tag', 'notes', cursor, opts);
}

export function fetchNotes(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/notes', 'notes', cursor, opts);
}

export function fetchMeetingNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/meetings', 'notes', cursor, opts);
}

export function fetchByProjectNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/by-project', 'notes', cursor, opts);
}

export function fetchClipsNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/clips', 'notes', cursor, opts);
}

export function fetchVoiceNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/voice', 'notes', cursor, opts);
}

export function fetchJournalNotes(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/journal', 'notes', cursor, opts);
}

export function fetchAllNotes(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Note>> {
  return requestPage('/api/notes/all', 'notes', cursor, opts);
}

export function fetchNotesForProject(
  projectId: string,
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage(`/api/notes/for-project/${projectId}`, 'notes', cursor, opts);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function fetchAllProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/all', 'projects', cursor, opts);
}

export function fetchDoingProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/doing', 'projects', cursor, opts);
}

export function fetchOngoingProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/ongoing', 'projects', cursor, opts);
}

export function fetchOnHoldProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/on-hold', 'projects', cursor, opts);
}

export function fetchDoneProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/done', 'projects', cursor, opts);
}

export function fetchPlannedProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/planned', 'projects', cursor, opts);
}

export function fetchBoardProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/board', 'projects', cursor, opts);
}

export function fetchArchivedProjects(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Project>> {
  return requestPage('/api/projects/archived', 'projects', cursor, opts);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function fetchRecentTags(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/recent', 'tags', cursor, opts);
}

export function fetchFavoriteTags(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/favorites', 'tags', cursor, opts);
}

export function fetchAToZTags(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/a-z', 'tags', cursor, opts);
}

export function fetchAreaTags(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/area', 'tags', cursor, opts);
}

export function fetchResourceTags(
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/resource', 'tags', cursor, opts);
}

export function fetchEntityTags(cursor?: string, opts?: RequestOptions): Promise<PagedResult<Tag>> {
  return requestPage('/api/tags/types/entity', 'tags', cursor, opts);
}

export function fetchNotesForTag(
  tagId: string,
  cursor?: string,
  opts?: RequestOptions,
): Promise<PagedResult<Note>> {
  return requestPage(`/api/notes/for-tag/${tagId}`, 'notes', cursor, opts);
}
