import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Task, Note, Project, Tag } from '@notion-ub/contracts'

export type ScreenName =
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
  | 'task-actions'
  | 'task-metadata'
  | 'delete-confirm'
  | 'delete-toast'
  | 'project-detail'
  | 'project-tasks'
  | 'project-notes'

export type RecordingState = 'idle' | 'recording' | 'processing' | 'confirm' | 'done' | 'error'

/** Anything a generic list screen can render — every domain record has a `name`. */
export type ListItem = Task | Note | Project | Tag

export interface AppState {
  screen: ScreenName
  startupRendered: boolean

  // Fetched list data for every list-view screen (Today/Overdue/Inbox and
  // every Tasks/Notes/Projects/Tags view), keyed by screen name. Today and
  // Overdue are both filtered views over the same fetched array, stored
  // under the 'today' key — see context.ts's DATA_KEY_OVERRIDES.
  lists: Partial<Record<ScreenName, ListItem[]>>

  // Task confirm dialog — kind is 'markDone' or 'delete'; returnTo is the list screen to
  // navigate back to (Today/Overdue/Inbox or a generic Tasks screen).
  pendingAction: { kind: 'markDone' | 'delete'; taskId: string; taskName: string; returnTo: ScreenName } | null

  // The task the action menu / metadata / delete flow is operating on.
  selectedTask: { taskId: string; taskName: string; returnTo: ScreenName } | null

  // Metadata screen data (fetched on demand).
  taskMetadata: { loading: boolean; project: string | null; due: string | null; error: string } | null

  // Task action toast (mark-done or delete); shown after API call completes.
  actionToast: { kind: 'markDone' | 'delete'; taskName: string; returnTo: ScreenName; untilMs: number } | null

  // The project the Tasks/Notes drill-down menu (and its two list screens)
  // is currently scoped to — returnTo is the Projects list screen to
  // navigate back to (Active/Planned/Board/Archived).
  selectedProject: { id: string; name: string; returnTo: ScreenName } | null

  // Voice recording
  recording: RecordingState
  createdTaskName: string
  pendingTranscript: string

  // Loading / background refresh
  loading: boolean      // true = no cache yet, first fetch in flight
  spinnerFrame: string  // current spinner char ('|','/','-','\\'); empty = not spinning
  errorMessage: string
}

export const state: AppState = {
  screen: 'menu',
  startupRendered: false,
  lists: {},
  pendingAction: null,
  selectedTask: null,
  taskMetadata: null,
  actionToast: null,
  selectedProject: null,
  recording: 'idle',
  createdTaskName: '',
  pendingTranscript: '',
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