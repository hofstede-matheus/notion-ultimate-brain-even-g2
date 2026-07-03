import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type Screen =
  | 'menu'
  | 'tasks-menu'
  | 'notes-menu'
  | 'projects-menu'
  | 'tags-menu'
  | 'overdue'
  | 'today'
  | 'inbox'
  | 'add-task'
  | 'tasks-next-7-days'
  | 'tasks-tomorrow'
  | 'notes-inbox'
  | 'notes-favorites'
  | 'notes-by-tag'
  | 'notes-list'
  | 'notes-meetings'
  | 'notes-by-project'
  | 'notes-clips'
  | 'notes-voice'
  | 'notes-journal'
  | 'notes-all'
  | 'projects-active'
  | 'projects-planned'
  | 'projects-board'
  | 'projects-archived'
  | 'tags-recent'
  | 'tags-favorites'
  | 'tags-a-z'
  | 'tags-types'
  | 'mark-done-confirm'
  | 'mark-done-toast'

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export interface Task {
  id: string
  name: string
  dueDate?: string
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

/** Anything a generic list screen can render — every domain record has a `name`. */
export type ListItem = Task | Note | Project | Tag

export interface AppState {
  screen: Screen
  startupRendered: boolean

  // Last listEvent selection reported by the firmware list widget (Menu).
  // The widget owns its own highlight and always starts at item 0 on
  // render (there is no way to set an initial index) — this field is
  // bookkeeping only, unused by rendering.
  menuSelectedIndex: number

  // Task data
  todayTasks: Task[]
  inboxTasks: Task[]

  // Last listEvent selection reported by the firmware list widget. The widget
  // owns its own highlight — these fields are stored for the future
  // task-detail screen and reset on screen entry.
  overdueSelectedIndex: number
  todaySelectedIndex: number
  inboxSelectedIndex: number

  // Generic storage for every other list-view screen (Tasks/Notes/Projects/
  // Tags views beyond Today/Inbox/Overdue, which keep their dedicated fields
  // above for backward compatibility). Keyed by Screen name.
  lists: Partial<Record<Screen, ListItem[]>>
  selectedIndex: Partial<Record<Screen, number>>

  // Mark-task-done confirm dialog / toast — returnTo is the list screen to
  // navigate back to (Today/Overdue/Inbox or a generic Tasks screen).
  pendingMarkDone: { taskId: string; taskName: string; returnTo: Screen } | null
  markDoneToast: { taskName: string; returnTo: Screen; untilMs: number } | null

  // Voice recording
  recording: RecordingState
  createdTaskName: string

  // Loading / background refresh
  loading: boolean      // true = no cache yet, first fetch in flight
  spinnerFrame: string  // current spinner char ('|','/','-','\\'); empty = not spinning
  errorMessage: string
}

export const state: AppState = {
  screen: 'menu',
  startupRendered: false,
  menuSelectedIndex: 0,
  todayTasks: [],
  inboxTasks: [],
  overdueSelectedIndex: 0,
  todaySelectedIndex: 0,
  inboxSelectedIndex: 0,
  lists: {},
  selectedIndex: {},
  pendingMarkDone: null,
  markDoneToast: null,
  recording: 'idle',
  createdTaskName: '',
  loading: false,
  spinnerFrame: '',
  errorMessage: '',
}

let _bridge: EvenAppBridge | null = null

export function getBridge(): EvenAppBridge | null {
  return _bridge
}

export function setBridge(b: EvenAppBridge): void {
  _bridge = b
}