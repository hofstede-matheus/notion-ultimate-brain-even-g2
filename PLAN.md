# Implementation Plan — Wire Up All Stub Screens

## Overview

18 stub screens need real Notion data. Each screen requires work across 4 layers:
server endpoint → client API → state → screen + router wiring.

The plan is organized per-domain (Tasks → Notes → Projects → Tags) so each
chunk is independently testable.

---

## Phase 1: Complete Notion View Discovery

Fetch linked-database views from the remaining dashboard sub-pages using the
Notion MCP tool so we know exact filter/sort logic for every screen.

### Already discovered (Tasks)

| Screen          | Linked DB ID                         | Filter Logic                                               |
|-----------------|--------------------------------------|------------------------------------------------------------|
| Today           | `1f63c6e7dd228118862ce0e23e0ea734`   | Status ≠ Complete AND Due ≤ today                          |
| Inbox           | `1f63c6e7dd2281e5987aeaa4ac905416`   | Status ≠ Complete AND Project empty AND Content empty AND Smart List ∉ {Do Next, Delegated, Someday} AND Snooze empty |
| Next 7 Days     | `1f63c6e7dd2281198a51e2b0742a799b`   | Status ≠ Complete AND Due ≤ 7 days from now                |
| All Tasks       | `1f63c6e7dd2281bea120f9a9a282ed2d`   | Status ≠ Complete                                          |
| Done            | (same All Tasks linked DB)           | Status = Complete                                          |
| Recurring       | (source DB view)                     | Recur Interval ≥ 1 AND Due not empty                      |

### Still need to fetch

| Domain   | Sub-page name    | Page ID                              |
|----------|------------------|--------------------------------------|
| Notes    | Note Inbox       | `1f63c6e7dd2281529620e8aebe94457b`   |
| Notes    | Favorites        | `1f63c6e7dd2281808189c2821eaee391`   |
| Notes    | All Notes        | `1f63c6e7dd228151a367fa58b4db8e2e`   |
| Notes    | Meeting Notes    | `1f63c6e7dd228134b394c2053c12eeea`   |
| Notes    | Journal          | `1f63c6e7dd2281129d18ea1d378838a3`   |
| Notes    | Review Queue     | `1f63c6e7dd22813282a6c0c1e5d2e343`   |
| Notes    | Note Board       | `1f63c6e7dd22815c8412e5e9089f006b`   |
| Projects | Projects by Status | `1f63c6e7dd2281a3bea9f2172d78c43b` |
| Projects | By Tag           | `1f63c6e7dd22813d9ff1cea4c989899e`   |
| Projects | By People        | `1f63c6e7dd2281ef84d6c2248a7f9821`   |
| Tags     | Areas            | `1f63c6e7dd2281049450d5a943e01a54`   |
| Tags     | Resources        | `1f63c6e7dd228177ba13d175107f8c74`   |
| Tags     | Entities         | `1f63c6e7dd2281ddac1bdc087f012df9`   |

---

## Phase 2: Tasks Domain (7 stub screens)

### 2a. Server endpoints — `server/index.ts`

All use existing `NOTION_TASKS_DB`.

```
GET /api/tasks/next-7-days   Status ≠ Done AND Due ≤ +7 days, sort Due asc
GET /api/tasks/tomorrow      Status ≠ Done AND Due = tomorrow, sort Due asc
GET /api/tasks/no-due        Status ≠ Done AND Due is empty, sort Name asc
GET /api/tasks/recurring     Recur Interval ≥ 1 AND Due not empty, sort Due asc
GET /api/tasks/all           Status ≠ Done, sort Name asc
GET /api/tasks/done          Status = Done, sort last-edited desc
GET /api/tasks/by-project    Status ≠ Done AND Project not empty, sort Name asc
```

Each returns `{ tasks: TaskResult[] }` using the existing `pageToTask()` helper.

### 2b. Client API — `src/api.ts`

Add fetch functions mirroring each endpoint:

```ts
fetchNextSevenDaysTasks(): Promise<Task[]>
fetchTomorrowTasks():      Promise<Task[]>
fetchNoDueTasks():         Promise<Task[]>
fetchRecurringTasks():     Promise<Task[]>
fetchAllTasks():           Promise<Task[]>
fetchDoneTasks():          Promise<Task[]>
fetchByProjectTasks():     Promise<Task[]>
```

### 2c. State — `src/state.ts`

Add to `Screen` union type:

```ts
| 'tasks-next-7-days'
| 'tasks-tomorrow'
| 'tasks-no-due'
| 'tasks-recurring'
| 'tasks-active-projects'
| 'tasks-all'
| 'tasks-done'
```

Add to `AppState`:

```ts
next7DaysTasks:       Task[]
tomorrowTasks:        Task[]
noDueTasks:           Task[]
recurringTasks:       Task[]
activeProjectsTasks:  Task[]
allTasks:             Task[]
doneTasks:            Task[]

// Selected-index fields for each new list screen
next7DaysSelectedIndex:      number
tomorrowSelectedIndex:       number
noDueSelectedIndex:          number
recurringSelectedIndex:      number
activeProjectsSelectedIndex: number
allSelectedIndex:            number
doneSelectedIndex:           number
```

### 2d. Context — `src/glasses/context.ts` + `src/glasses/types.ts`

Add `GlassCtx` entry points (same pattern as `enterToday`/`enterInbox`):

```ts
enterNext7Days():       void
enterTomorrow():        void
enterNoDue():           void
enterRecurring():       void
enterActiveProjects():  void
enterAll():             void
enterDone():            void
```

Each follows the existing `enterOverdueOrToday` cache-then-fetch pattern:
1. Reset selected index → 0
2. Load cached tasks (new cache keys)
3. Navigate to screen
4. Start spinner + fetch fresh data
5. Stop spinner + re-render

### 2e. Screens — `src/glasses/screens/tasks/*.ts`

Replace each `makeStubScreen(...)` with a real screen implementation.
Follow the existing `today.ts` / `inbox.ts` pattern:

```ts
// Example: src/glasses/screens/tasks/next-7-days.ts
display(state, nav) → {
  const tasks = getNext7DaysFlatTasks(state)
  if (state.loading && tasks.length === 0) → "Fetching…" text
  if (tasks.length === 0)                  → "No tasks" text
  else                                     → { mode: 'list', header, items }
}

action(action, nav, state, ctx) → {
  GO_BACK       → ctx.navigate('tasks-menu')
  SELECT_HIGHLIGHTED → (future: open detail)
}
```

Add helper functions to `shared.ts`:

```ts
getNext7DaysFlatTasks(state):      Task[]   // state.next7DaysTasks
getTomorrowFlatTasks(state):       Task[]   // state.tomorrowTasks
getNoDueFlatTasks(state):          Task[]   // state.noDueTasks
getRecurringFlatTasks(state):      Task[]   // state.recurringTasks
getActiveProjectsFlatTasks(state): Task[]   // state.activeProjectsTasks
getAllFlatTasks(state):             Task[]   // state.allTasks
getDoneFlatTasks(state):           Task[]   // state.doneTasks
```

### 2f. Router + Menu wiring

**`router.ts`** — import and register all 7 new screens in the `SCREENS` map.

**`tasks/menu.ts`** — add `target` to each item:

```ts
{ label: 'Next 7 Days', target: 'tasks-next-7-days' },
{ label: 'Tomorrow',    target: 'tasks-tomorrow' },
{ label: 'No Due',      target: 'tasks-no-due' },
{ label: 'Recurring',   target: 'tasks-recurring' },
{ label: 'Active Projects', target: 'tasks-active-projects' },
{ label: 'All',         target: 'tasks-all' },
{ label: 'Done',        target: 'tasks-done' },
```

**`tasks/menu.ts` `open()` router** — add cases for each new target calling the
corresponding `ctx.enter*()` method.

### 2g. Render — `src/glasses/render.ts`

Add `show*()` functions for each new screen (same pattern as `showOverdue`,
`showToday`, `showInbox`).

### 2h. Cache — `src/cache.ts`

Add cache keys for each new task list:

```ts
CACHE_KEY_NEXT_7_DAYS
CACHE_KEY_TOMORROW
CACHE_KEY_NO_DUE
CACHE_KEY_RECURRING
CACHE_KEY_ACTIVE_PROJECTS
CACHE_KEY_ALL
CACHE_KEY_DONE
```

---

## Phase 3: Notes Domain (5 app screens)

### 3a. Server endpoints — `server/index.ts`

Uses `NOTION_NOTES_DB` (new env var to read in server config).

```
GET /api/notes/list       All notes, sort last-edited desc
GET /api/notes/inbox      Filter TBD from view discovery (likely: uncategorized)
GET /api/notes/favorites  Favorite = checked/true
GET /api/notes/meetings   Type = "Meeting Notes"
GET /api/notes/all        All notes, sort Name asc
```

Each returns `{ notes: NoteResult[] }` with a new `pageToNote()` helper
extracting `id`, `name`, `icon?`, `lastEdited?`.

### 3b. Types

```ts
// server/index.ts
interface NoteResult { id: string; name: string }

// src/state.ts
export interface Note { id: string; name: string }
```

### 3c. Client API — `src/api.ts`

```ts
fetchNotes():         Promise<Note[]>
fetchInboxNotes():    Promise<Note[]>
fetchFavoriteNotes(): Promise<Note[]>
fetchMeetingNotes():  Promise<Note[]>
fetchAllNotes():      Promise<Note[]>
```

### 3d. State — `src/state.ts`

Add to `Screen`:

```ts
| 'notes-list'
| 'notes-inbox'
| 'notes-favorites'
| 'notes-meetings'
| 'notes-all'
```

Add to `AppState`:

```ts
notes:          Note[]
inboxNotes:     Note[]
favoriteNotes:  Note[]
meetingNotes:   Note[]
allNotes:       Note[]

notesSelectedIndex:          number
notesInboxSelectedIndex:     number
notesFavoritesSelectedIndex: number
notesMeetingsSelectedIndex:  number
notesAllSelectedIndex:       number
```

### 3e. Context, Screens, Router, Menu, Render, Cache

Same pattern as Tasks (Phase 2d–2h) adapted for Notes domain.

**`notes/menu.ts`** — wire targets:

```ts
{ label: 'Notes',     target: 'notes-list' },
{ label: 'Inbox',     target: 'notes-inbox' },
{ label: 'Favorites', target: 'notes-favorites' },
{ label: 'Meetings',  target: 'notes-meetings' },
{ label: 'All',       target: 'notes-all' },
```

---

## Phase 4: Projects Domain (3 app screens)

### 4a. Server endpoints — `server/index.ts`

Uses `NOTION_PROJECTS_DB`.

```
GET /api/projects/active    Status = Active (or In Progress), sort Name asc
GET /api/projects/planned   Status = Planned (or Not Started), sort Name asc
GET /api/projects/all       All projects, sort Name asc
```

Returns `{ projects: ProjectResult[] }` with `pageToProject()`.

### 4b. Types

```ts
interface ProjectResult { id: string; name: string; status?: string }
export interface Project { id: string; name: string; status?: string }
```

### 4c–4e. Client API, State, Context, Screens, Router, Menu, Render, Cache

Same pattern. Screen names: `'projects-active'`, `'projects-planned'`, `'projects-board'`.

**`projects/menu.ts`** — wire targets:

```ts
{ label: 'Active',  target: 'projects-active' },
{ label: 'Planned', target: 'projects-planned' },
{ label: 'Board',   target: 'projects-board' },
```

---

## Phase 5: Tags Domain (3 app screens)

### 5a. Server endpoints — `server/index.ts`

Uses `NOTION_TAGS_DB`.

```
GET /api/tags/recent     All tags, sort last-edited desc, page_size 20
GET /api/tags/favorites  Favorite = checked/true, sort Name asc
GET /api/tags/a-z        All tags, sort Name asc
```

Returns `{ tags: TagResult[] }` with `pageToTag()`.

### 5b. Types

```ts
interface TagResult { id: string; name: string }
export interface Tag { id: string; name: string }
```

### 5c–5e. Client API, State, Context, Screens, Router, Menu, Render, Cache

Same pattern. Screen names: `'tags-recent'`, `'tags-favorites'`, `'tags-a-z'`.

**`tags/menu.ts`** — wire targets:

```ts
{ label: 'Recent',    target: 'tags-recent' },
{ label: 'Favorites', target: 'tags-favorites' },
{ label: 'A-Z',       target: 'tags-a-z' },
```

---

## Phase 6: Refine Inbox Filter

The current `/api/tasks/inbox` filter only checks `Project is_empty AND Status ≠ Done`.
The real Notion Inbox view also excludes:
- Smart List ∈ {Do Next, Delegated, Someday}
- Snooze is not empty
- Content is not empty

Update the server filter to match the real Notion view logic (exact property
names to be confirmed from view discovery).

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `server/index.ts` | Add ~15 new endpoints, read new env vars, add `pageToNote`/`pageToProject`/`pageToTag` helpers |
| `src/api.ts` | Add ~15 new fetch functions |
| `src/state.ts` | Extend `Screen` union (18 new values), extend `AppState` (new arrays + selected indices), add `Note`/`Project`/`Tag` types |
| `src/glasses/types.ts` | Extend `GlassCtx` with new `enter*()` methods |
| `src/glasses/context.ts` | Implement new `enter*()` methods (cache-then-fetch pattern) |
| `src/glasses/router.ts` | Import and register 18 new screens |
| `src/glasses/render.ts` | Add `show*()` functions for each new screen |
| `src/glasses/screens/shared.ts` | Add getter helpers for each new task/note/project/tag list |
| `src/glasses/screens/tasks/menu.ts` | Add `target` to 7 items, add cases to `open()` |
| `src/glasses/screens/notes/menu.ts` | Add `target` to 5 items, add `open()` router |
| `src/glasses/screens/projects/menu.ts` | Add `target` to 3 items, add `open()` router |
| `src/glasses/screens/tags/menu.ts` | Add `target` to 3 items, add `open()` router |
| `src/glasses/screens/tasks/*.ts` (7 files) | Replace `makeStubScreen` with real implementation |
| `src/glasses/screens/notes/*.ts` (5 files) | Replace `makeStubScreen` with real implementation |
| `src/glasses/screens/projects/*.ts` (3 files) | Replace `makeStubScreen` with real implementation |
| `src/glasses/screens/tags/*.ts` (3 files) | Replace `makeStubScreen` with real implementation |
| `src/cache.ts` | Add cache keys for all new lists |
| `.env` / `.env.example` | Already done — all 4 DB IDs present |

---

## Order of Execution

1. **Phase 1** — Fetch remaining Notion views (Notes, Projects, Tags) to lock
   down exact filters before writing server code.
2. **Phase 2** — Tasks (largest domain, most infrastructure exists, filters known).
3. **Phase 3** — Notes.
4. **Phase 4** — Projects.
5. **Phase 5** — Tags.
6. **Phase 6** — Inbox filter refinement.

Each phase is a self-contained, testable unit.
