import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type Screen = 'menu' | 'today' | 'inbox' | 'add-task'

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export interface Task {
  id: string
  name: string
  dueDate?: string
}

export interface AppState {
  screen: Screen
  startupRendered: boolean

  // Menu
  menuSelectedIndex: number

  // Task data
  todayTasks: Task[]
  inboxTasks: Task[]

  // Per-screen cursors (which task is highlighted)
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