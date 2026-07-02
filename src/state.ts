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

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export interface Task {
  id: string
  name: string
  dueDate?: string
}

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