import type { Task } from './state'

/**
 * API client for the GlassTask backend server.
 *
 * In development, Vite proxies /api/* to the backend (localhost:3210).
 * In production, set API_BASE to your server URL.
 */

const API_BASE = ''

export async function fetchTodayTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/tasks/today`)
  if (!res.ok) throw new Error(`Failed to fetch today tasks: ${res.status}`)
  const data = await res.json()
  return data.tasks
}

export async function fetchInboxTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/tasks/inbox`)
  if (!res.ok) throw new Error(`Failed to fetch inbox tasks: ${res.status}`)
  const data = await res.json()
  return data.tasks
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
