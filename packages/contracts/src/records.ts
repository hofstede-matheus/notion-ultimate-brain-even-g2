/**
 * Domain record shapes shared by the glasses client and the server — the
 * server's Notion-page mappers (mappers.ts) produce these; the glasses app
 * (state.ts) renders them. Kept in one place so a field rename can't
 * silently drift between the two.
 */

export interface Task {
  id: string
  name: string
  dueDate?: string
  status?: string
}

export interface Note {
  id: string
  name: string
  icon?: string
  lastEdited?: string
}

export interface Project {
  id: string
  name: string
  status?: string
}

export interface Tag {
  id: string
  name: string
}
