# GlassTask behaviour specs

Gherkin specifications for every user-facing flow in this app: what the glasses show, what each
gesture does, and what the phone asks for during setup.

These are **documentation**, not tests. There is no Cucumber runner, no step definitions, and no
dependency added to the build. Nothing here runs in CI — the vitest suites under
`apps/glasses/src/__tests__/**` and `apps/server/src/__tests__/**` remain the executable
verification. A `.feature` file here is the answer to "what is this supposed to do?", written so a
person can read it without opening the source.

On-screen copy is quoted **verbatim**. If a spec and the app disagree, one of them is a bug —
find out which before changing either.

For repo layout, commands and agent-facing gotchas, see [../CLAUDE.md](../CLAUDE.md).

## Scope

Covered:

- **`features/glasses/`** — everything on the G2 display: menus, list views, the task and note
  action menus, confirming and undoing changes, the due-date calendar, reading a page, adding a
  task by voice, and how long lists are paged through.
- **`features/phone/`** — the phone app: connecting, entering a Notion token, choosing the four
  databases, changing settings, and the debug log.

Not covered: the server API — routes, auth, and the Notion query filters behind each view. Those
business rules live in `apps/server/src/views.ts` and `apps/server/src/filters.ts`. If specs are
wanted for them, they belong in `features/server/`.

## How these are written

Every scenario describes something a person using the app can see or do. Nothing here describes
how the app is built — no screen names, no function names, no internal limits, no explanations of
why the hardware behaves as it does.

Two rules follow from that, and they are the ones most often broken:

- **If it cannot be observed by using the app, it is not a scenario.** Work the app does quietly
  belongs in code comments, not here.
- **A scenario lives where you reach it.** Every menu is a folder, so a flow is described at the
  depth it actually sits. Where tasks and notes share a flow, each keeps its own copy rather than
  pointing at a shared one — the copy on screen differs, and so does which list the item leaves.

## Vocabulary

The glasses are driven entirely from the touchpad on the temple, with three gestures:

| Phrase in a spec | What the user does |
|---|---|
| **tap** | one tap |
| **double-tap** | two taps — always means "go back" |
| **swipe down** | move down a list, or turn to the next page |
| **swipe up** | move up a list, or turn back a page |

Other conventions:

- *"the glasses show"* = the G2 display. *"the phone shows"* = the app on the phone.
- *"the header"* = the top line of a glasses screen — the title, and sometimes a count, a page
  number, or a spinner while something loads.
- A **list** is a view of tasks, notes, projects or tags. A **menu** is a fixed set of choices.
- Dates are written out as `Mon D, YYYY` — e.g. `Jul 4, 2026`.

## Tags

| Tag | Meaning |
|---|---|
| `@glasses` / `@phone` | which part of the app the behaviour belongs to |
| `@tasks` `@notes` `@projects` `@tags` `@shared` `@navigation` `@settings` `@diagnostics` | area |
| `@known-gap` | describes what the app does today, where that is a rough edge worth fixing rather than a decision worth keeping |

Search `@known-gap` for the running list of rough edges — it is the closest thing this repo has to
a behavioural bug list.

## Index

The folders are the app's own menus. Every menu you can open is a layer, so a spec sits exactly
where you would reach it: `tasks/a-task/change-due-date/confirm.feature` is what you get after
tapping a task, choosing "Change due date", and picking a day.

Tasks and notes each carry their own copy of the flows they share — deleting, filing under a
project, reading a page. They read the same but they are not the same flow, and each is described
where it is reached.

The few files at the top of `glasses/` are not menus: they are the behaviours that hold from the
root menu downward, wherever you happen to be.

### On the glasses

```
root-menu.feature                          Tasks · Notes · Projects · Tags
the-three-gestures.feature                 tap, double-tap, swipe
how-a-list-looks.feature                   headers, counts, long names, empty lists
paging-a-long-list.feature                 when there is more than a screenful
opening-a-list-again.feature               what comes back instantly, and what is stale
confirming-a-change.feature                the confirm-then-acknowledge pattern
how-a-page-reads.feature                   what survives from Notion, and what does not

tasks/
  tasks-menu.feature                       Add Task · Today · Overdue · Inbox · Next 7 Days · Tomorrow
  add-task-by-voice.feature                dictating a new task
  task-lists.feature                       the five lists, and what they mean
  a-task/
    action-menu.feature                    the six things a task can do
    task-details.feature                   its full name, project and due date
    open-page/
      reading.feature                      reading it a screenful at a time
    change-due-date/
      calendar.feature                     the month grid, week then day
      confirm.feature                      saving the new date
    change-project/
      picker.feature                       the list of projects
      confirm.feature                      filing it, and which lists it leaves
    mark-as-done/
      confirm.feature                      completing it
    delete-task/
      confirm.feature                      sending it to the Bin

notes/
  notes-menu.feature                       the ten note views
  note-lists.feature                       the lists themselves
  a-note/
    action-menu.feature                    the four things a note can do
    note-details.feature                   its project
    open-page/
      reading.feature                      reading it a screenful at a time
    change-project/
      picker.feature                       the list of projects
      confirm.feature                      filing it, and which lists it leaves
    delete-note/
      confirm.feature                      sending it to the Bin

projects/
  projects-menu.feature                    Doing · Ongoing · Planned · On Hold · Done · Archived
  project-lists.feature                    the lists themselves
  a-project/
    contents-menu.feature                  Tasks or Notes
    tasks/
      which-tasks.feature                  To Do or Done
      task-lists.feature                   the two lists
    notes/
      project-notes.feature                everything written down against it

tags/
  tags-menu.feature                        Recent · Fav. · A-Z · Types
  tag-lists.feature                        the lists themselves
  types/
    tag-types-menu.feature                 Area · Resource · Entity
  a-tag/
    tag-notes.feature                      the notes carrying that tag
```

### On the phone

```
status-screen/
  connecting.feature                       from "app opened" to "use your glasses"
  glasses-connection.feature               the connection dot and its warning

settings/
  first-run-setup.feature                  the setup that cannot be skipped
  integration-token.feature                entering the Notion token
  choosing-the-databases.feature           the four dropdowns
  changing-settings-later.feature          reopening and backing out
  debug-log.feature                        reading and copying the log
```

## If these are ever made executable

Nothing here is wired to a runner, but the bindings already exist if that changes: the glasses
harness at `apps/glasses/src/__tests__/glasses/harness.ts` drives a screen and returns exactly
what it displays, and the phone's settings logic is already unit-tested.
