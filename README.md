# Notion Ultimate Brain — Even Realities G2

A GTD task manager for [Even Realities G2](https://www.evenrealities.com/) smart glasses,
backed by Notion. View today's tasks, process your inbox, browse notes/projects/tags, read
a page's contents a screenful at a time, act on an item (mark done, reschedule, reassign,
delete), and capture new tasks by voice — all from the glasses.

The project is multi-tenant: each device holds its own Notion integration token and
database IDs (entered in the app's Settings screen), sent with every request via the
`X-Notion-Config` header. The backend never stores Notion credentials.

## What you can do from the glasses

- **Tasks** — Inbox, Today, Tomorrow, Next 7 days. Open a task's action menu to load its
  metadata (project + due date), read its page, **change the due date** on a bitmap-drawn
  month calendar, **change its project**, mark it done, or delete it.
- **Notes** — Inbox, Favorites, By tag, By project, Meetings, Web clips, Voice notes,
  Journal, All. Same action menu, minus due dates: open page, load metadata, change
  project, delete.
- **Projects** — Doing, Ongoing, Planned, On hold, Done, Board, Archived. Drill into a
  project to see its open/done tasks and its notes.
- **Tags** — Recent, Favorites, A–Z, and a Types submenu split by Area / Resource / Entity;
  drill a tag into the notes filed under it.
- **Page reader** — a task's or note's page renders as pre-paginated screenfuls of text,
  turned with a swipe (falling back to the page's Description property when its body is
  empty, as most Ultimate Brain tasks are).
- **Voice capture** — dictate a new task offline on-device; confirm the transcript before
  it's written to Notion.

Lists paginate across both Notion's cursor and the G2's 20-item display cap, and fetched
lists are cached on the device so revisiting a view is instant.

## Monorepo architecture

This is a [Turborepo](https://turborepo.dev) + [pnpm workspaces](https://pnpm.io/workspaces)
monorepo with two apps and two shared packages:

```
apps/
  glasses/    @notion-ub/glasses — the G2 webview app (Vite + TypeScript)
  server/     @notion-ub/server — the Notion API backend (Express locally, AWS Lambda in prod)
packages/
  contracts/          @notion-ub/contracts — shared record/DTO types (Task, Note, Project, Tag,
                      TenantConfig, Notion page shapes) used by both apps
  typescript-config/  @notion-ub/typescript-config — shared tsconfig base + variants
```

- **`apps/glasses`** — two front ends in one Vite build.
  - `src/glasses/` renders on the glasses via the Even Realities SDK
    (`@evenrealities/even_hub_sdk`): a screen table (`router.ts`), an event layer
    (`events/`), a render layer (`render/`), and per-domain `modules/` (`tasks`, `notes`,
    `projects`, `tags`) over a `_shared/` core — generic list screens, pagination, the page
    reader, the project picker, and one confirm→toast flow behind every item action.
    `bitmap/` is a small 1-bit BMP encoder + 5×7 font used to draw the due-date calendar,
    which the G2 has no native widget for.
  - `src/web/` is a React 19 + Tailwind v4 phone webview (status + Settings screens),
    layered into `providers/` · `hooks/` · `services/` · `components/` · `screens/`. This
    is where the tenant config is entered and persisted.
  - Packaged into a `.ehpk` bundle with the
    [Even Hub CLI](https://www.npmjs.com/package/@evenrealities/evenhub-cli). Offline voice
    capture uses [Vosk](https://alphacephei.com/vosk/) (`vosk-browser`).
- **`apps/server`** — a thin, framework-agnostic route layer (`src/routes.ts`) with two
  entry points that share the same handlers: `src/express/index.ts` for local dev, and
  `src/lambda/handler.ts` for production (bundled with esbuild, deployed via Terraform as
  an AWS Lambda Function URL — see `apps/server/terraform/`). Most routes sit behind the
  full tenant gate; `GET /api/databases` is the one token-only route, since the settings
  form's database picker runs before any database ID is known.
- **`packages/typescript-config`** — `base.json` (shared strict compiler options) plus
  `dom.json` (glasses, browser libs) and `node.json` (server, Node types), consumed by each
  app via `extends`.

Turborepo wires up `build` / `dev` / `test` / `check-types` tasks across both apps and
caches task output, so `pnpm <task>` at the root fans out to every workspace that defines
it.

### Why the server stays a proxy

The app is free, and the server is the only part anyone pays to run. Every millisecond of
Lambda time is a bill that grows with the number of devices, while the phone running the
webview is already paid for and idle. So the rule is: **the server forwards, the client
decides.**

A handler should do no more than attach the tenant's token, call Notion, and hand the
response back. Anything that could run on the device runs on the device — parsing,
formatting, pagination for the display, caching. The page reader is the worked example:
`GET /api/pages/:id/markdown` and `GET /api/pages/:id` are one Notion call each, and every
decision about what the result means — turning Notion's own markdown export into display
text, falling back to a page's Description property when its body is empty — lives in
`apps/glasses/src/page-loader.ts` and `apps/glasses/src/glasses/content/markdown-to-pages.ts`.

This also keeps the blast radius small — the backend holds no state and stores no
credentials, so it can't leak what it never has. The one deliberate exception is the
list-view mappers (`src/mappers.ts`), which shrink a large Notion page object down to the
handful of fields a list row needs; that trades a little server work for a much smaller
payload over a phone-tethered link.

## Prerequisites

- Node.js ≥ 20.9
- [pnpm](https://pnpm.io) 9 (`corepack enable pnpm` or `npm i -g pnpm@9`)
- A Notion integration token, with your Tasks/Notes/Projects/Tags databases shared with
  that integration. The database IDs are picked in-app, not set in an env file — see
  `apps/glasses/src/tenant-config.ts`.

## Setup

```bash
pnpm install
```

## Running locally

```bash
pnpm dev
```

Runs both apps in parallel via Turborepo: the Express server on `http://localhost:3210`
and the Vite dev server (glasses webview) on `http://localhost:5173`, which proxies
`/api/*` to the server. Open `http://localhost:5173` and go to Settings: paste your Notion
integration token, and the form lists every database that token can see so you can pick
Tasks / Notes / Projects / Tags from dropdowns instead of hunting down IDs. Save, and the
app starts syncing.

For local iteration you can skip re-entering settings each run by setting
`VITE_NOTION_TOKEN` / `VITE_NOTION_TASKS_DB` / `VITE_NOTION_NOTES_DB` /
`VITE_NOTION_PROJECTS_DB` / `VITE_NOTION_TAGS_DB` — they're read only under `vite dev`,
never in a built app.

To run one app at a time:

```bash
pnpm --filter @notion-ub/server dev     # Express only
pnpm --filter @notion-ub/glasses dev    # Vite only
```

## Testing

```bash
pnpm test              # both apps, via turbo
pnpm --filter @notion-ub/server test    # server only
pnpm --filter @notion-ub/glasses test   # glasses only
```

Glasses tests live in `apps/glasses/src/__tests__/`, mirroring the source tree, and drive
screens through a shared harness rather than the real SDK.

## Reporting a bug

The phone webview keeps a running trace of everything the app does — key presses,
screen changes, selections, cache hits/misses, and every API request/response/failure
— in a debug log at the bottom of the Settings screen (tap the gear icon). To report a
bug: reproduce it, open Settings, tap **Copy log**, and paste the result into the bug
report/email. The buffer survives an app reload (persisted, tagged as "previous
session"), and the Notion integration token is scrubbed automatically before anything
is shown or copied. See `apps/glasses/src/logging/` for the implementation.

## Type checking

```bash
pnpm check-types
```

## Building

```bash
pnpm build
```

- `apps/server` → esbuild bundles `src/lambda/handler.ts` into `dist-lambda/index.js`
  (the AWS Lambda deployment artifact).
- `apps/glasses` → Vite builds the webview into `dist/`.

To package the glasses app into a `.ehpk` for the Even Hub:

```bash
pnpm --filter @notion-ub/glasses pack
```

(Fetches the offline voice model on first run via `pnpm --filter @notion-ub/glasses fetch:voice-model`
if it isn't present.)

## Deploying the server

The server deploys as an AWS Lambda behind a Function URL, managed with Terraform
(`apps/server/terraform/`, using a Terraform Cloud backend):

```bash
pnpm --filter @notion-ub/server tf:init
pnpm --filter @notion-ub/server tf:plan
pnpm --filter @notion-ub/server tf:apply
```

CI (`.github/workflows/deploy-lambda.yml`) builds and applies automatically on push to
`main` when `apps/server/**` changes. `.github/workflows/build-ehpk.yml` similarly builds
and uploads the `.ehpk` artifact when `apps/glasses/**` changes — but only when that push
also bumped `apps/glasses/package.json`'s version, so an unversioned change doesn't
produce a duplicate build.
