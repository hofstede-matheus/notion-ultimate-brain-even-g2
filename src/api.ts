import type { Task, Note, Project, Tag } from './state'

/**
 * API client for the GlassTask backend server.
 *
 * In development, Vite proxies /api/* to the backend (localhost:3210).
 * In production, set API_BASE to your server URL.
 */

const API_BASE = ''

async function fetchList<T>(path: string, resultKey: string, label: string): Promise<T[]> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Failed to fetch ${label}: ${res.status}`)
  const data = await res.json()
  return data[resultKey]
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function fetchInboxTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/inbox', 'tasks', 'inbox tasks')
}

export function fetchTodayTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/today', 'tasks', 'today tasks')
}

export function fetchNext7DaysTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/next-7-days', 'tasks', 'next 7 days tasks')
}

export function fetchTomorrowTasks(): Promise<Task[]> {
  return fetchList('/api/tasks/tomorrow', 'tasks', 'tomorrow tasks')
}

export async function createTask(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function fetchInboxNotes(): Promise<Note[]> {
  return fetchList('/api/notes/inbox', 'notes', 'inbox notes')
}

export function fetchFavoriteNotes(): Promise<Note[]> {
  return fetchList('/api/notes/favorites', 'notes', 'favorite notes')
}

export function fetchByTagNotes(): Promise<Note[]> {
  return fetchList('/api/notes/by-tag', 'notes', 'notes by tag')
}

export function fetchNotes(): Promise<Note[]> {
  return fetchList('/api/notes/notes', 'notes', 'notes')
}

export function fetchMeetingNotes(): Promise<Note[]> {
  return fetchList('/api/notes/meetings', 'notes', 'meeting notes')
}

export function fetchByProjectNotes(): Promise<Note[]> {
  return fetchList('/api/notes/by-project', 'notes', 'notes by project')
}

export function fetchClipsNotes(): Promise<Note[]> {
  return fetchList('/api/notes/clips', 'notes', 'clip notes')
}

export function fetchVoiceNotes(): Promise<Note[]> {
  return fetchList('/api/notes/voice', 'notes', 'voice notes')
}

export function fetchJournalNotes(): Promise<Note[]> {
  return fetchList('/api/notes/journal', 'notes', 'journal notes')
}

export function fetchAllNotes(): Promise<Note[]> {
  return fetchList('/api/notes/all', 'notes', 'all notes')
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function fetchActiveProjects(): Promise<Project[]> {
  return fetchList('/api/projects/active', 'projects', 'active projects')
}

export function fetchPlannedProjects(): Promise<Project[]> {
  return fetchList('/api/projects/planned', 'projects', 'planned projects')
}

export function fetchBoardProjects(): Promise<Project[]> {
  return fetchList('/api/projects/board', 'projects', 'board projects')
}

export function fetchArchivedProjects(): Promise<Project[]> {
  return fetchList('/api/projects/archived', 'projects', 'archived projects')
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function fetchRecentTags(): Promise<Tag[]> {
  return fetchList('/api/tags/recent', 'tags', 'recent tags')
}

export function fetchFavoriteTags(): Promise<Tag[]> {
  return fetchList('/api/tags/favorites', 'tags', 'favorite tags')
}

export function fetchAToZTags(): Promise<Tag[]> {
  return fetchList('/api/tags/a-z', 'tags', 'A-Z tags')
}

export function fetchTypeTags(): Promise<Tag[]> {
  return fetchList('/api/tags/types', 'tags', 'tag types')
}
