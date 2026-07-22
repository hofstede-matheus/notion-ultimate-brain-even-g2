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

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchInboxTasks(): Promise<Task[]> {
  return request('/api/tasks/inbox', {}, 'tasks');
}

export function fetchTodayTasks(): Promise<Task[]> {
  return request('/api/tasks/today', {}, 'tasks');
}

export function fetchNext7DaysTasks(): Promise<Task[]> {
  return request('/api/tasks/next-7-days', {}, 'tasks');
}

export function fetchTomorrowTasks(): Promise<Task[]> {
  return request('/api/tasks/tomorrow', {}, 'tasks');
}

export function createTask(name: string): Promise<{ id: string; name: string }> {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function markTaskDone(id: string): Promise<void> {
  await request(`/api/tasks/${id}/done`, { method: 'PATCH' });
}

export function fetchTasksForProject(projectId: string): Promise<Task[]> {
  return request(`/api/tasks/for-project/${projectId}`, {}, 'tasks');
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

export function fetchInboxNotes(): Promise<Note[]> {
  return request('/api/notes/inbox', {}, 'notes');
}

export function fetchFavoriteNotes(): Promise<Note[]> {
  return request('/api/notes/favorites', {}, 'notes');
}

export function fetchByTagNotes(): Promise<Note[]> {
  return request('/api/notes/by-tag', {}, 'notes');
}

export function fetchNotes(): Promise<Note[]> {
  return request('/api/notes/notes', {}, 'notes');
}

export function fetchMeetingNotes(): Promise<Note[]> {
  return request('/api/notes/meetings', {}, 'notes');
}

export function fetchByProjectNotes(): Promise<Note[]> {
  return request('/api/notes/by-project', {}, 'notes');
}

export function fetchClipsNotes(): Promise<Note[]> {
  return request('/api/notes/clips', {}, 'notes');
}

export function fetchVoiceNotes(): Promise<Note[]> {
  return request('/api/notes/voice', {}, 'notes');
}

export function fetchJournalNotes(): Promise<Note[]> {
  return request('/api/notes/journal', {}, 'notes');
}

export function fetchAllNotes(): Promise<Note[]> {
  return request('/api/notes/all', {}, 'notes');
}

export function fetchNotesForProject(projectId: string): Promise<Note[]> {
  return request(`/api/notes/for-project/${projectId}`, {}, 'notes');
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function fetchActiveProjects(): Promise<Project[]> {
  return request('/api/projects/active', {}, 'projects');
}

export function fetchPlannedProjects(): Promise<Project[]> {
  return request('/api/projects/planned', {}, 'projects');
}

export function fetchBoardProjects(): Promise<Project[]> {
  return request('/api/projects/board', {}, 'projects');
}

export function fetchArchivedProjects(): Promise<Project[]> {
  return request('/api/projects/archived', {}, 'projects');
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function fetchRecentTags(): Promise<Tag[]> {
  return request('/api/tags/recent', {}, 'tags');
}

export function fetchFavoriteTags(): Promise<Tag[]> {
  return request('/api/tags/favorites', {}, 'tags');
}

export function fetchAToZTags(): Promise<Tag[]> {
  return request('/api/tags/a-z', {}, 'tags');
}

export function fetchTypeTags(): Promise<Tag[]> {
  return request('/api/tags/types', {}, 'tags');
}
