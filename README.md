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
  details (project + due date), read its page, **change the due date** on a bitmap-drawn
  month calendar, **change its project**, mark it done, or delete it.
- **Notes** — Inbox, Favorites, By tag, By project, Meetings, Web clips, Voice notes,
  Journal, All. Same action menu, minus due dates: open page, load details, change
  project, delete.
- **Projects** — Doing, Ongoing, Planned, On hold, Done, Board, Archived. Drill into a
  project to see its open/done tasks and its notes.
- **Tags** — Recent, Favorites, A–Z, and a Types submenu split by Area / Resource / Entity;
  drill a tag into the notes filed under it.
- **Page reader** — a task's or note's page renders as pre-paginated screenfuls of text,
  turned with a swipe (falling back to the page's Description property when its body is
  empty, as most Ultimate Brain tasks are).
- **Voice capture** — dictate a new task, offline on-device or via your own Soniox key;
  confirm the transcript before it's written to Notion.

Lists paginate across both Notion's cursor and the G2's 20-item display cap, and fetched
lists are cached on the device so revisiting a view is instant.

## Monorepo architecture

This is a [Turborepo](https://turborepo.dev) + [pnpm workspaces](https://pnpm.io/workspaces)
monorepo with three apps and two shared packages:

```
apps/
  glasses/       @notion-ub/glasses — the G2 webview app (Vite + TypeScript)
  server/        @notion-ub/server — the Notion API backend (Express locally, AWS Lambda in prod)
  landing-page/  @notion-ub/landing-page — static marketing site, deployed to Firebase Hosting
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
    [Even Hub CLI](https://www.npmjs.com/package/@evenrealities/evenhub-cli). Speech
    recognition has two interchangeable backends behind `src/stt/`:
    [Vosk](https://alphacephei.com/vosk/) (`vosk-browser`) on-device, or
    [Soniox](https://soniox.com) over a WebSocket.
- **`apps/server`** — a thin, framework-agnostic route layer (`src/routes.ts`) with two
  entry points that share the same handlers: `src/express/index.ts` for local dev, and
  `src/lambda/handler.ts` for production (bundled with esbuild, deployed via Terraform as
  an AWS Lambda Function URL — see `apps/server/terraform/`). Most routes sit behind the
  full tenant gate; `GET /api/databases` is the one token-only route, since the settings
  form's database picker runs before any database ID is known. Logging is deliberately
  sparse and is a promise made publicly on the [privacy page](apps/landing-page/legal.html):
  a successful request logs nothing, a failure logs only
  `{ method, route, status, errorCode? }` via [pino](https://getpino.io)
  (`src/lambda/logger.ts`), and `route` is the pattern (`/api/pages/:id`) rather than the
  real path, which would carry Notion page IDs. No response bodies, no error messages, no
  headers, and no flag to turn any of it back on — see **Conventions** in
  [CLAUDE.md](CLAUDE.md) before changing it.
- **`apps/landing-page`** — a static, script-free marketing site (markup derived from the
  Even Hub developer portal with its Nuxt/Vue runtime stripped out; see its own
  [README](apps/landing-page/README.md) for how it was built). `pnpm build` just copies
  `index.html`/`css`/`fonts`/`img` into `dist/`; it isn't part of the `check-types`/`test`
  graph and deploys separately to Firebase Hosting.
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

- Node.js ≥ 24 (`.nvmrc` pins the exact version — run `nvm use` after installing nvm)
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
— in a debug log at the bottom of the Settings screen. To report a
bug: reproduce it, open Settings, tap the version label at the bottom ten times to
reveal the log, tap **Copy log**, and paste the result into the bug
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

- `apps/server` → two independent esbuild bundles: `build:lambda` bundles
  `src/lambda/handler.ts` (deps included) into `dist-lambda/index.js`, the AWS Lambda
  deployment artifact; `build:express` bundles `src/express/index.ts` (deps external) into
  `dist/index.js`, runnable with `node dist/index.js`. `pnpm build` runs both.
- `apps/glasses` → Vite builds the webview into `dist/`.

To package the glasses app into a `.ehpk` for the Even Hub:

```bash
pnpm --filter @notion-ub/glasses pack
```

The voice model is **not** part of this bundle — see below.

### Voice input

Dictating a task needs a speech recogniser, and the app ships without one. Users pick a mode
in the settings screen:

- **On-device** — downloads an offline [Vosk](https://alphacephei.com/vosk/) model (English,
  ~41 MB) to the phone once, then recognises speech locally. No network, no key, no audio
  leaves the device.
- **Cloud** — streams audio to [Soniox](https://soniox.com) over a WebSocket using the user's
  own API key, stored on the device and sent only to Soniox. No download, 60+ languages,
  billed to their Soniox account.

The two are exclusive — there is no automatic fallback, because that would make it impossible
to say whether a given recording left the device. Add Task by voice stays visible on the
glasses either way, and explains what to set up when it can't run.

The Vosk model used to be packed into the `.ehpk`, which put the package at ~45 MB against a
~10 MB practical cap for install-over-Bluetooth. It is now hosted separately and fetched at
runtime into IndexedDB.

#### Publishing the offline model

The model lives on its own Firebase Hosting site (`notion-ub-assets`), deliberately separate
from the landing page: a Hosting deploy replaces the whole site, so sharing one would let a
landing-page deploy wipe the model. Publishing is manual — run the **Deploy voice model**
workflow (`workflow_dispatch`), optionally with a language key.

To do it locally, or to check the catalog:

```bash
# see the supported language keys
node apps/glasses/scripts/fetch-vosk-model.cjs --list

# fetch one into apps/glasses/dist-model/ (delete it first to switch languages)
pnpm --filter @notion-ub/glasses fetch:voice-model -- fr   # note the `--`, needed for pnpm
                                                             # to forward the arg to the script

firebase deploy --only hosting:notion-ub-assets
```

Any Vosk model `.zip` URL can be passed instead of a key (e.g. a larger, more accurate model
than the "small" tier) — see the full catalog at
[alphacephei.com/vosk/models](https://alphacephei.com/vosk/models). Only English is published
today; the client fetches a single fixed URL, overridable in dev with `VITE_VOICE_MODEL_URL`.

## Running the server on its own

You don't need the glasses app or the landing page to run the API server — it's a normal
Express app you can clone and host yourself. It holds no Notion credentials of its own
(every request carries the tenant's token via `X-Notion-Config`/`X-Notion-Token`), so
there's nothing to configure besides the port.

```bash
git clone https://github.com/hofstede-matheus/notion-ultimate-brain-even-g2.git
cd notion-ultimate-brain-even-g2
pnpm install
cp apps/server/.env.example apps/server/.env   # PORT, defaults to 3210
pnpm --filter @notion-ub/server dev            # tsx watch — good for local iteration
```

To run it without `tsx`, e.g. on a host that just runs `node`:

```bash
pnpm --filter @notion-ub/server build:express  # bundles src/express/index.ts -> dist/index.js
node apps/server/dist/index.js
```

### Pointing the glasses app at your own server

The packaged glasses app is a static build — it can't be reconfigured after the fact, so
the server URL has to be baked in at build time via `VITE_API_BASE`
(`apps/glasses/src/api.ts`):

```bash
VITE_API_BASE=https://your-server.example.com pnpm --filter @notion-ub/glasses pack
```

That produces a `.ehpk` pointed at your own server instead of the maintainer's Lambda.
Upload/sideload it through the Even Hub developer portal — see
[Packaging & Shipping](https://hub.evenrealities.com/docs/ship/packaging) for the flow.

You're welcome to add the app to your own Even Hub developer account and create private
builds from there to use yourself. **Please don't submit it for public store listing,
though.** `apps/glasses/app.json` keeps the original `package_id` and `name` ("Ultimate
Brain"), so a public listing of a fork would sit alongside the original under the same
identity — anyone could install a build talking to *your* server thinking it's the
maintainer's, and the Even Hub store ends up with several listings that look identical.
Private/developer-hub use is fine; public listing isn't.

## Deploying the server

The server deploys as an AWS Lambda behind a Function URL, managed with Terraform
(`apps/server/terraform/`, using a Terraform Cloud backend):

```bash
pnpm --filter @notion-ub/server tf:init
pnpm --filter @notion-ub/server tf:plan
pnpm --filter @notion-ub/server tf:apply
```

CI (`.github/workflows/deploy-lambda.yml`) builds and applies automatically on push to
`main` when `apps/server/**` changes. The glasses `.ehpk` is built on release instead —
see [Releasing the glasses app](#releasing-the-glasses-app) below.

**Advanced: deploying your own copy.** The Terraform stack and CI workflow above are wired
to this project's own AWS account and Terraform Cloud workspace (`apps/server/terraform/versions.tf`).
To deploy your own fork, point that `cloud { organization / workspaces }` block at your own
Terraform Cloud org, and replace the repo's `TF_API_TOKEN` GitHub Actions secret with your
own Terraform Cloud API token — plus `AWS_DEPLOY_ROLE_ARN` (see the bootstrap note at the
top of `terraform/github-oidc.tf`).

## Releasing the glasses app

Releases are automated with [release-please](https://github.com/googleapis/release-please)
(`release-please-config.json`, `.release-please-manifest.json`). Nobody edits a version by
hand.

1. Land work on `main` with [Conventional Commit](https://www.conventionalcommits.org)
   messages. PRs are squash-merged, so the **PR title** is the commit that counts —
   `.github/workflows/pr-title.yml` blocks a title that isn't one, and `.husky/commit-msg`
   catches bad messages locally before they leave your machine.
2. `.github/workflows/release-please.yml` keeps a release PR open, titled
   `chore(glasses): release X.Y.Z`. It bumps `apps/glasses/package.json` **and**
   `apps/glasses/app.json` (the G2 hub manifest), and writes `apps/glasses/CHANGELOG.md`.
   `feat` commits bump the minor, `fix` bumps the patch, `feat!`/`BREAKING CHANGE:` bumps
   the major; anything else doesn't bump at all.
3. Merging that PR tags `glasses-vX.Y.Z`, cuts a GitHub Release from the changelog, and
   chains into `.github/workflows/build-ehpk.yml`, which builds the `.ehpk` and attaches it
   to the Release as an asset (`gh release view glasses-vX.Y.Z`). That file is what gets
   uploaded to the Even Hub store.

Two things worth knowing:

- release-please only counts commits that touch `apps/glasses/**`. A user-visible change
  delivered entirely through `packages/contracts` won't trigger a release on its own — pair
  it with a glasses-side commit, or add a `Release-As: X.Y.Z` footer to force one.
- `apps/server`, the root `package.json`, and `apps/landing-page` are **not** managed by
  release-please; their versions stay manual.

## Deploying the landing page

`apps/landing-page` deploys to [Firebase Hosting](https://firebase.google.com/docs/hosting)
(`firebase.json`, `.firebaserc`, target `notion-ub-landing`, project `hofsdev`).
`.github/workflows/deploy-landing.yml` builds and deploys to the live channel on push to
`main` when `apps/landing-page/**`, `firebase.json`, or `.firebaserc` change.
`.github/workflows/firebase-hosting-pull-request.yml` builds a preview channel for PRs
touching those same paths.

The landing page also hosts the project's [Privacy Policy & Terms](apps/landing-page/legal.html)
(`legal.html`, served at `/legal`), written against what the code actually does — worth
re-reading when you change how data is stored, logged, or transmitted.

## License

[Apache License 2.0](LICENSE). Fork it, modify it, add features, bundle a different speech or
language model, use it privately or commercially — all permitted, no permission needed.

Two things that aren't license conditions but are worth reading: the request about public Even
Hub listings (see [Pointing the glasses app at your own server](#pointing-the-glasses-app-at-your-own-server)
above) and the trademark disclaimer. Both live in [NOTICE](NOTICE), which the License requires
redistributors to carry along.

This is an independent, unofficial project. "Notion" is a trademark of Notion Labs, Inc.;
"Ultimate Brain" is a product and trademark of Thomas Frank; "Even Realities", "Even Hub" and
"G2" are trademarks of Even Realities. No affiliation or endorsement is claimed, and the
copyright holder claims no rights in any of those marks.
