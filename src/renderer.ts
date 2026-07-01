import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge } from './state'
import type { Task } from './state'

const W = 576
const H = 288

// ---------------------------------------------------------------------------
// Rebuild helper — handles first-call (startup) vs subsequent (rebuild)
// ---------------------------------------------------------------------------

async function rebuildPage(config: {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
}): Promise<void> {
  const b = getBridge()
  if (!b) return

  if (!state.startupRendered) {
    await b.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    state.startupRendered = true
    return
  }

  await b.rebuildPageContainer(new RebuildPageContainer(config))
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export const MENU_ITEMS = [
  'Today\'s Tasks',
  'Inbox',
  'Add Task (Voice)',
]

function menuContent(): string {
  return MENU_ITEMS.map((item, i) =>
    `${i === state.menuSelectedIndex ? '>' : ' '} ${item}`,
  ).join('\n')
}

export async function showMenu(): Promise<void> {
  state.screen = 'menu'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'menu',
        content: menuContent(),
        xPosition: 0,
        yPosition: 0,
        width: W,
        height: H,
        isEventCapture: 1,
        paddingLength: 8,
      }),
    ],
  })
}

export async function updateMenuContent(): Promise<void> {
  const b = getBridge()
  if (!b) return

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'menu',
      content: menuContent(),
    }),
  )
}

// ---------------------------------------------------------------------------
// Today's Tasks
// ---------------------------------------------------------------------------

/**
 * Returns the flat, ordered list of tasks shown on the Today screen.
 * Order: overdue first (oldest due date), then due-today.
 * Single source of truth used by both formatting and event handlers
 * (the latter need it for bounds clamping).
 */
export function getTodayFlatTasks(): Task[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayStr = now.toISOString().split('T')[0]!

  const overdue = state.todayTasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr,
  )
  const today = state.todayTasks.filter((t) => t.dueDate === todayStr)
  return [...overdue, ...today]
}

/**
 * Returns the flat list of inbox tasks (preserves state order).
 */
export function getInboxFlatTasks(): Task[] {
  return state.inboxTasks
}

function formatTodayContent(tasks: Task[]): string {
  const spin = state.spinnerFrame ? `  ${state.spinnerFrame}` : ''
  const title = `TODAY'S TASKS${spin}`

  // First load — no cache available yet
  if (state.loading) {
    return [title, '', 'Fetching tasks...'].join('\n')
  }

  if (tasks.length === 0) {
    return [
      title,
      '',
      'No tasks due! You\'re all clear.',
      '',
      'Double-tap to go back.',
    ].join('\n')
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayStr = now.toISOString().split('T')[0]

  const overdue: Task[] = []
  const todayList: Task[] = []

  for (const t of tasks) {
    if (!t.dueDate) continue
    if (t.dueDate === todayStr) {
      todayList.push(t)
    } else if (t.dueDate < todayStr) {
      overdue.push(t)
    }
  }

  const lines: string[] = [title, '']
  let flatIndex = 0

  if (overdue.length > 0) {
    lines.push(`OVERDUE (${overdue.length}):`)
    for (const t of overdue) {
      lines.push(`${flatIndex === state.todaySelectedIndex ? '>' : '  '} ${t.name}`)
      flatIndex++
    }
    lines.push('')
  }

  if (todayList.length > 0) {
    lines.push(`TODAY (${todayList.length}):`)
    for (const t of todayList) {
      lines.push(`${flatIndex === state.todaySelectedIndex ? '>' : '  '} ${t.name}`)
      flatIndex++
    }
  }

  if (overdue.length === 0 && todayList.length === 0) {
    lines.push('No tasks for today.')
  }

  lines.push('', 'Double-tap to go back.')
  return lines.join('\n')
}

export async function showToday(): Promise<void> {
  state.screen = 'today'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'today',
        content: formatTodayContent(state.todayTasks),
        xPosition: 0,
        yPosition: 0,
        width: W,
        height: H,
        isEventCapture: 1,
        paddingLength: 8,
      }),
    ],
  })
}

export async function updateTodayContent(): Promise<void> {
  const b = getBridge()
  if (!b) return

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'today',
      content: formatTodayContent(state.todayTasks),
    }),
  )
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

function formatInboxContent(tasks: Task[]): string {
  const spin = state.spinnerFrame ? `  ${state.spinnerFrame}` : ''

  // First load — no cache available yet
  if (state.loading) {
    return [`INBOX${spin}`, '', 'Fetching tasks...'].join('\n')
  }

  if (tasks.length === 0) {
    return [
      `INBOX${spin}`,
      '',
      'Your inbox is empty!',
      '',
      'Double-tap to go back.',
    ].join('\n')
  }

  const lines: string[] = [`INBOX (${tasks.length})${spin}`, '']

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!
    lines.push(`${i === state.inboxSelectedIndex ? '>' : '  '} ${t.name}`)
  }

  lines.push('', 'Double-tap to go back.')
  return lines.join('\n')
}

export async function showInbox(): Promise<void> {
  state.screen = 'inbox'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'inbox',
        content: formatInboxContent(state.inboxTasks),
        xPosition: 0,
        yPosition: 0,
        width: W,
        height: H,
        isEventCapture: 1,
        paddingLength: 8,
      }),
    ],
  })
}

export async function updateInboxContent(): Promise<void> {
  const b = getBridge()
  if (!b) return

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'inbox',
      content: formatInboxContent(state.inboxTasks),
    }),
  )
}

// ---------------------------------------------------------------------------
// Add Task (Voice)
// ---------------------------------------------------------------------------

function addTaskContent(): string {
  switch (state.recording) {
    case 'idle':
      return [
        'ADD TASK',
        '',
        'Tap to start recording.',
        '',
        'Speak your task — stops',
        'automatically on silence.',
        '',
        'Double-tap to go back.',
      ].join('\n')

    case 'recording':
      return [
        'ADD TASK',
        '',
        '>>> RECORDING <<<',
        '',
        'Speak your task now...',
        '',
        'Stops on silence.',
        'Tap to stop early.',
      ].join('\n')

    case 'processing':
      return [
        'ADD TASK',
        '',
        'Processing audio...',
        'Please wait.',
      ].join('\n')

    case 'done':
      return [
        'ADD TASK',
        '',
        'Task created!',
        '',
        `"${state.createdTaskName}"`,
        '',
        'Tap to add another.',
        'Double-tap to go back.',
      ].join('\n')

    case 'error':
      return [
        'ADD TASK',
        '',
        'Error:',
        state.errorMessage || 'Something went wrong.',
        '',
        'Tap to try again.',
        'Double-tap to go back.',
      ].join('\n')
  }
}

export async function showAddTask(): Promise<void> {
  state.screen = 'add-task'
  state.recording = 'idle'
  state.createdTaskName = ''
  state.errorMessage = ''

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'voice',
        content: addTaskContent(),
        xPosition: 0,
        yPosition: 0,
        width: W,
        height: H,
        isEventCapture: 1,
        paddingLength: 8,
      }),
    ],
  })
}

export async function updateAddTaskContent(): Promise<void> {
  const b = getBridge()
  if (!b) return

  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'voice',
      content: addTaskContent(),
    }),
  )
}