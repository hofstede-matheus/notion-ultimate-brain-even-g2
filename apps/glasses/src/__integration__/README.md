# Integration tests

Drives the real `evenhub-simulator` (pinned 0.8.0) headlessly over its
automation HTTP API, against a real Vite dev server, against a fixture HTTP
server standing in for `apps/server`. Run with:

```bash
pnpm --filter @notion-ub/glasses test:integration
# or from the repo root:
pnpm test:integration
```

Needs a desktop session locally (the simulator is a real GUI window) and takes
roughly a minute. Not part of `pnpm test` — see CLAUDE.md's Testing section for
where this suite fits. CI runs it as a separate job in `.github/workflows/ci.yml`
(`integration`), under Xvfb on `ubuntu-latest`; a fresh runner avoids the stale
WebKit-profile trap described below.

Vitest sometimes prints `close timed out after 10000ms` / `something
prevents Vite server from exiting` after the results table. That's Node's
global fetch keep-alive pool holding a socket open inside vitest's own
transform server — harmless (exit code stays 0, "Tests closed successfully"
is printed first) and unrelated to the suite's actual pass/fail result.

## Why this exists

Every test under `src/__tests__/**` mocks the Even Realities SDK bridge
(`__tests__/glasses/fakes.ts`'s `makeMockBridge()`), which returns success
unconditionally for every call. That means **no unit test has ever confirmed
a container payload is actually accepted and painted** — the class of bug
CLAUDE.md's Gotchas section is full of: the 63-UTF-8-byte item cap, the
20-item cap, the 4-container limit, `createStartUpPageContainer` being
one-shot. The simulator enforces these for real; unit tests structurally
cannot.

## Division of labour — read this before adding a spec

| Question | Suite |
|---|---|
| Are the right items/header text produced? | Unit (`src/__tests__/glasses/**`) |
| Does the SDK **accept** the payload (caps, container count, one-shot startup)? | Integration |
| Did anything actually get **painted**? | Integration |
| Does a real hardware event JSON round-trip to the right action? | Integration |
| Does the flow reach the right screens over real HTTP? | Integration |

**Don't duplicate the unit suite here.** A spec in this directory should
almost never assert exact item text — that's already covered, in far less
time, by `harness.ts`'s `mount()/dispatch()/render()`. Add an integration
spec when a change introduces or reshapes a whole user-facing flow (a new
screen tree, a new mutation round trip, a new render mode). Most changes,
including most bug fixes, don't need one — a unit regression test is enough.
See CLAUDE.md's Testing section for the exact rule.

## Why the assertions look the way they do

The automation API is `/api/ping`, `/api/console`, `/api/screenshot/*`,
`/api/input` — **there is no way to inspect the running app's JS state**.
Every assertion here is built from one of:

1. The app's own `trace.*` lines, read back via `/api/console` (see
   `driver/app.ts`'s `waitForLine`/`hasLine`).
2. Absence of an error/warn/rejection line (`driver/app.ts`'s
   `assertNoErrors`, run in `specs/_setup.ts`'s `afterEach` for every spec).
3. A lit-pixel ratio on the glasses framebuffer PNG (`driver/png.ts`), never
   pixel-exact — font rendering shifts across simulator versions.

This is deliberate, not a workaround: it keeps every spec coupled to
something the app itself claims happened, the same signal you'd read
manually via the `simulator-debug` skill.

## Fixture server, not real `apps/server`

`fixture-server/server.ts` implements the same 15 route shapes as
`apps/server/src/routes.ts`, typed against `@notion-ub/contracts`, with no
Notion credentials and no network call. `apps/server` itself stays out of
this loop on purpose — its routes and mappers already have 126 unit tests,
and keeping Notion out of the picture entirely means a mutating spec (e.g.
mark-done) can never touch anything real.

The dataset (`fixtures.ts`) is **static** — a mutation route records the call
(inspectable at `GET /__calls`) but never changes what a later `GET`
returns. Specs assert a mutation happened via the recorded call and the
app's own trace lines, not by re-fetching and diffing a list. This also
means specs are order-independent: nothing one spec does can change what
fixture data another spec sees.

An unmatched route is a loud `501`, not a hang — if a spec calls an endpoint
this fixture doesn't implement, that shows up as a named failure.

## Config isolation

`vite.e2e.config.ts` never loads `apps/glasses/.env.local` (your real Notion
token). `envDir` points at `src/__integration__/.runtime/env`, a directory
`global-setup.ts` generates fresh on every run with a synthetic
`VITE_NOTION_*` config, gitignored. `getDevEnvConfig()` picks this up the
same way it would your real `.env.local` in ordinary dev.

Each run gets a unique `tasksDb` value, which — since `cacheKeyForScreen()`
namespaces the on-device cache by `tasksDb.slice(0, 8)` — gives every run a
fresh cache namespace, so a previous run's cached list can never warm-start
the current one.

**One thing this can't isolate**: the simulator's own local storage (backed
by its OS-level WebKit/WebKitGTK/WebView2 profile, not this repo) persists
across launches. If you once ran `pnpm sim` manually and filled in the
Settings form by hand, that saved config is still there and will beat the
env-based config on every future boot, including this suite's — `boot.ts`
checks `loadStoredConfig()` before `getDevEnvConfig()`. `global-setup.ts`
detects this (`config source = stored` instead of `config source = env`)
and fails with the exact cleanup command for your platform, rather than
silently running against the wrong tenant.

## Spec ordering — files are NOT run in name order

Vitest sorts test files **largest-first**, not alphabetically (confirmed: this
suite runs 06, 03, 05, 04, 02, 01). The `NN-` prefixes are for reading order
only. Tests *within* one file do run in declaration order — that is the only
ordering guarantee available, so any two specs whose order actually matters
must live in the same file.

## Known cross-spec hazard: `projectPicker` (not fixed here)

`state.projectPicker`, set by `openProjectPicker`
(`modules/_shared/project-picker.ts`), is **never cleared in production** —
only the unit test harness clears it. Once set, every project list screen's
`parent`/`onSelect` branches on it for the rest of the session, so tapping a
project stops opening it and starts assigning it to whatever item was last
selected for "Change project".

That is a real product bug (tracked separately), and it constrains this suite:
both project flows share `07-projects-and-picker.test.ts`, drill-down first
and picker second, because the picker test poisons project browsing for
everything after it. Splitting them into two files would break the drill-down
test whenever vitest happened to schedule it second. Leave them together until
the leak is fixed.

## Adding a spec

1. Add any fixture data it needs to `fixtures.ts`, keeping it on its own
   view/screen so it can't collide with another spec's data.
2. Add fixture-server routes only if the flow calls an endpoint not already
   implemented — check `fixture-server/server.ts`'s `ROUTES` table first.
3. Write the spec against `driver/app.ts`'s `AppDriver` — `tap`/`swipeUp`/
   `swipeDown`/`back`, `waitForLine`, `currentScreen`, `assertLit`. Import
   `driver` from `./_setup`, which already wires `resetToRootMenu` +
   `assertNoErrors` around every test.
4. Name it `NN-description.test.ts`, next number up. All specs share one
   simulator session (`fileParallelism: false`), so write it to run from and
   return to the root menu, and never assume another spec ran first — see
   "Spec ordering" above.
