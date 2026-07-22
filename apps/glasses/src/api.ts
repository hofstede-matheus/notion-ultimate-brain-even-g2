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

/** fetch() wrapper that attaches the current tenant's Notion config header. */
function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, 'X-Notion-Config': getTenantHeader() },
  });
}

async function fetchList<T>(path: string, resultKey: string, label: string): Promise<T[]> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${label}: ${res.status}`);
  const data = await res.json();
  return data[resultKey];
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchInboxTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/inbox', 'tasks', 'inbox tasks');
}

export function fetchTodayTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/today', 'tasks', 'today tasks');
}

export function fetchNext7DaysTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/next-7-days', 'tasks', 'next 7 days tasks');
}

export function fetchTomorrowTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/tomorrow', 'tasks', 'tomorrow tasks');
}

export async function createTask(name: string): Promise<{ id: string; name: string }> {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return res.json();
}

export async function markTaskDone(id: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${id}/done`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to mark task done: ${res.status}`);
}

export function fetchTasksForProject(projectId: string): Promise<Task[]> {
  return fetchList(`/api/tasks/for-project/${projectId}`, 'tasks', 'tasks for project');
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
export async function fetchPageMetadata(id: string): Promise<PageMetadata> {
  const res = await apiFetch(`/api/pages/${id}/metadata`);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}

/** Moves a page (task, note, or anything else) to the Notion Bin. */
export async function deletePage(id: string): Promise<void> {
  const res = await apiFetch(`/api/pages/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
}

/**
 * A page's body as Notion's own enhanced markdown — untouched. Turning it
 * into display text is the reader's job (see glasses/markdown-to-pages.ts).
 */
export async function fetchPageMarkdown(id: string): Promise<NotionPageMarkdown> {
  const res = await apiFetch(`/api/pages/${id}/markdown`);
  if (!res.ok) throw new Error(`Failed to fetch page content: ${res.status}`);
  return res.json();
}

/**
 * A page object. The reader's only use for it is the Description property —
 * markdown covers a page's body, and many Ultimate Brain tasks keep their
 * text in this property instead, with no body content at all.
 */
export async function fetchPage(id: string): Promise<NotionPageObject> {
  const res = await apiFetch(`/api/pages/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function fetchInboxNotes(): Promise<Note[]> {
  return fetchList('/api/notes/inbox', 'notes', 'inbox notes');
}

export function fetchFavoriteNotes(): Promise<Note[]> {
  return fetchList('/api/notes/favorites', 'notes', 'favorite notes');
}

export function fetchByTagNotes(): Promise<Note[]> {
  return fetchList('/api/notes/by-tag', 'notes', 'notes by tag');
}

export function fetchNotes(): Promise<Note[]> {
  return fetchList('/api/notes/notes', 'notes', 'notes');
}

export function fetchMeetingNotes(): Promise<Note[]> {
  return fetchList('/api/notes/meetings', 'notes', 'meeting notes');
}

export function fetchByProjectNotes(): Promise<Note[]> {
  return fetchList('/api/notes/by-project', 'notes', 'notes by project');
}

export function fetchClipsNotes(): Promise<Note[]> {
  return fetchList('/api/notes/clips', 'notes', 'clip notes');
}

export function fetchVoiceNotes(): Promise<Note[]> {
  return fetchList('/api/notes/voice', 'notes', 'voice notes');
}

export function fetchJournalNotes(): Promise<Note[]> {
  return fetchList('/api/notes/journal', 'notes', 'journal notes');
}

export function fetchAllNotes(): Promise<Note[]> {
  return fetchList('/api/notes/all', 'notes', 'all notes');
}

export function fetchNotesForProject(projectId: string): Promise<Note[]> {
  return fetchList(`/api/notes/for-project/${projectId}`, 'notes', 'notes for project');
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function fetchActiveProjects(): Promise<Project[]> {
  return fetchList('/api/projects/active', 'projects', 'active projects');
}

export function fetchPlannedProjects(): Promise<Project[]> {
  return fetchList('/api/projects/planned', 'projects', 'planned projects');
}

export function fetchBoardProjects(): Promise<Project[]> {
  return fetchList('/api/projects/board', 'projects', 'board projects');
}

export function fetchArchivedProjects(): Promise<Project[]> {
  return fetchList('/api/projects/archived', 'projects', 'archived projects');
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function fetchRecentTags(): Promise<Tag[]> {
  return fetchList('/api/tags/recent', 'tags', 'recent tags');
}

export function fetchFavoriteTags(): Promise<Tag[]> {
  return fetchList('/api/tags/favorites', 'tags', 'favorite tags');
}

export function fetchAToZTags(): Promise<Tag[]> {
  return fetchList('/api/tags/a-z', 'tags', 'A-Z tags');
}

export function fetchTypeTags(): Promise<Tag[]> {
  return fetchList('/api/tags/types', 'tags', 'tag types');
}
