# CLAUDE.md

Guidance for AI agents working in this repo. Keep it short and current; when you learn
something an agent would trip on, add it here. For the full narrative (what the app does,
deploy details), see [README.md](README.md).

## What this is

A GTD task manager for Even Realities G2 smart glasses, backed by Notion. Turborepo +
pnpm-workspaces monorepo. Multi-tenant: each device sends its own Notion token + database
IDs via the `X-Notion-Config` header; the server stores no credentials.

## Layout

- `apps/glasses` (`@notion-ub/glasses`) — Vite app with two front ends in one build, plus
  shared plumbing at `src/` root (`api.ts`, `state.ts`, `cache.ts`, `page-loader.ts`,
  `stt.ts`, `tenant-config.ts`, `boot.ts`, `logging/`).
  - `src/glasses/` — on-glasses UI via the Even Realities SDK. `router.ts` (screen table),
    `menu.ts`, `constants.ts` (display geometry, container IDs, caps), `glass-ctx.ts`,
    `events/` (SDK event → action), `render/` (`index.ts` draw calls +
    `containers.ts` layouts), `content/markdown-to-pages.ts`, `bitmap/` (1-bit BMP encoder,
    framebuffer, 5×7 font), and `modules/` — `tasks`, `notes`, `projects`, `tags` each with
    `screens/`, plus `_shared/` (`item-actions.ts`, `project-picker.ts`, `page-reader.ts`,
    `pagination.ts`, `navigation.ts`, `screen-factories.ts`, confirm/toast screens).
    `modules/tasks/calendar/` holds the due-date picker (`month-grid.ts`, `draw.ts`,
    `picker.ts`).
  - `src/web/` — React 19 + Tailwind v4 phone webview, layered: `App.tsx`, `providers/`
    (UiState + Log), `hooks/`, `services/` (`config.ts` persistence, `databases.ts` picker),
    `components/`, `screens/` (StatusScreen, `SettingsForm/` with `dbSelection.ts` and
    `LogConsole.tsx`). The tenant config itself lives at `src/tenant-config.ts`.
- `apps/server` (`@notion-ub/server`) — Notion API backend. `src/routes.ts` is a
  framework-agnostic route table shared by two entry points: `src/express/index.ts` (local
  dev) and `src/lambda/handler.ts` + `lambda/match-route.ts` (prod, esbuild →
  `dist-lambda/`, deployed via Terraform in `terraform/`). Helpers: `notion-client.ts`,
  `mappers.ts`, `filters.ts`, `views.ts`, `tenant.ts`, `config.ts`, `lambda/logger.ts`
  (structured request logging via pino).
- `apps/landing-page` (`@notion-ub/landing-page`) — static, script-free marketing site
  (Nuxt-derived markup with the JS runtime stripped, see its own
  [README](apps/landing-page/README.md)). `pnpm build` just copies `index.html`/`css`/
  `fonts`/`img` into `dist/`; deployed to Firebase Hosting, not part of the Node
  build/test/check-types graph.
- `packages/contracts` (`@notion-ub/contracts`) — shared types (Task, Note, Project, Tag,
  TenantConfig, NotionDatabaseSummary, Notion page shapes). Import cross-app types from
  here, not by reaching into another app.
- `packages/typescript-config` — `base.json` + `dom.json` (glasses) + `node.json` (server).
- `docs/features/` — Gherkin specs of every user-facing flow (glasses UI + phone webview),
  documentation only, no runner. See [docs/README.md](docs/README.md) for the index and
  conventions; read the relevant `.feature` file before changing behaviour it describes, and
  update it in the same change if the behaviour moves.

## Commands (run from repo root; turbo fans out)

```bash
pnpm install
pnpm dev            # Express :3210 + Vite :5173 (proxies /api/* to server)
pnpm test           # vitest in both apps
pnpm check-types    # tsc --noEmit across workspaces
pnpm lint           # biome check .
pnpm lint:fix       # biome check --write .
pnpm build          # server → esbuild lambda bundle; glasses → Vite dist/
```

Scope to one workspace with `pnpm --filter @notion-ub/server <task>` /
`--filter @notion-ub/glasses <task>`. Package the glasses `.ehpk` with
`pnpm --filter @notion-ub/glasses pack`. Preview on the desktop simulator (pinned
to `@evenrealities/evenhub-simulator@0.7.3` — its container caps are
version-specific, see `glasses/constants.ts`) with `pnpm --filter
@notion-ub/glasses sim`, alongside `pnpm dev` serving Vite on :5173.

## Conventions

- **Server is a proxy; the client decides.** A handler attaches the tenant token, calls
  Notion, and returns the response — nothing more. Parsing, formatting, display pagination,
  and caching run on the device (the phone is free; Lambda time is billed). The deliberate
  exception is `src/mappers.ts`, which shrinks Notion objects to list-row fields to cut
  payload size. Don't add business logic to the server without a payload/latency reason.
- **Route auth is per-route.** `Route.auth` defaults to `'tenant'` (full `X-Notion-Config`:
  token + all 4 DB ids). `'token'` requires only `X-Notion-Token` — for routes that run
  before DB ids are known, i.e. the settings form's database picker (`GET /api/databases`).
  Use the `authed()` / `tokenAuthed()` wrappers rather than non-null assertions.
- **Page-level actions are generic over tasks and notes.** `PATCH /api/pages/:id/project`,
  `DELETE /api/pages/:id`, `GET /api/pages/:id/metadata` don't care which database the page
  is in; on the client, `modules/_shared/item-actions.ts` runs one confirm→toast flow for
  markDone/delete/setDue/setProject. Add a new item action there, not per-module.
- **Formatting/linting is Biome** (`biome.json`), not ESLint/Prettier. Run `pnpm lint`
  before finishing.
- **TypeScript strict** everywhere via the shared config. No new `any`.
- Never commit without explicit user consent for that specific commit.

## Gotchas

- **Notion status filters need the real option name, not the group label.** Tasks use
  `Done` (not "Complete"); Projects use `Doing`/`Ongoing` (not "In progress"). Group labels
  silently match nothing. Same trap on Tags' `Type` (`Area`/`Resource`/`Entity`).
- **Byte-vs-char truncation.** The glasses display truncates by display width; watch the
  byte-vs-char distinction when cutting strings for the SDK. Native list caps live in
  `glasses/constants.ts`: `MAX_LIST_ITEMS` (20) and `MAX_ITEM_BYTES` (63 **UTF-8 bytes**,
  not JS chars — accented names overflow early, and one oversized item rejects the whole
  rebuild).
- **G2 container rules** (`glasses/render/containers.ts`, `glasses/constants.ts`): the
  firmware matches containers by name+ID against the first `createStartUpPageContainer`, so
  names must stay **stable** (and ≤16 chars) for the app's lifetime; a container absent from
  the immediately preceding rebuild can't be re-added, which is why id=2 ships an inert 1×1
  placeholder on text-only screens. The calendar's image containers are the deliberate
  exception — declared only on that screen to stay under the simulator's 4-container cap.
- **Bitmaps are BMP, not PNG.** A 1-bit PNG renders solid green on G2 firmware; the 1-bit
  BMP encoder in `glasses/bitmap/bmp.ts` decodes correctly through `updateImageRawData`.
  Drawing code is pure (no DOM/SDK) so it tests under vitest's node environment.
- **Reader pages must fit with zero overflow.** Leftover overflow re-arms the firmware's
  internal scroll and swipes get swallowed — see `READER_LINES_PER_PAGE` /
  `READER_CHARS_PER_LINE` in `glasses/constants.ts`.
- The offline voice model isn't in git. `pnpm dev`/`build` expect
  `apps/glasses/public/vosk/model.tar.gz`; fetch it with
  `pnpm --filter @notion-ub/glasses fetch:voice-model`. The script takes an optional
  language key (default English) — see README's "Building with a different voice-input
  language".
- **Server logging is a privacy contract, not a convenience.** `apps/server/src/lambda/logger.ts`
  wraps pino with no `transport` (pino-pretty/multi-target spawn a worker that loads a script
  by path, which doesn't survive the esbuild single-file bundle). What it logs is deliberately
  minimal and is promised publicly on the landing page's `legal.html`:
  **successful requests log nothing at all**, and a failure logs only
  `{ method, route, status, errorCode? }`. `route` is the route **pattern**
  (`/api/pages/:id`), never `event.rawPath` — the raw path embeds Notion page IDs. Response
  bodies and error *messages* are never logged in any case (they're task/note titles and page
  markdown); `RouteResult.errorCode` carries a Notion error *code* as the loggable substitute.
  **No env var may widen this** — the lambda ships with no environment variables at all, and
  adding a verbosity flag would break a published promise, so don't.
  `__tests__/logger.test.ts` and the `logging` block in `__tests__/handler.test.ts`
  assert the exact key set; if you add a field they fail on purpose. Lambda freezes the
  execution environment right after the handler returns, so `handler.ts` awaits `flushLogger()`
  before returning — don't add a log call after that point or it can be lost.
- CI (`.github/workflows/ci.yml`) runs lint + `turbo run check-types test build` on PRs and
  pushes to `main`. `deploy-lambda.yml` deploys on push to `main` when `apps/server/**`
  changes; `build-ehpk.yml` builds the `.ehpk` on `apps/glasses/**` changes **only if
  `apps/glasses/package.json`'s version was bumped in that push**. `deploy-landing.yml`
  deploys `apps/landing-page` to Firebase Hosting on push to `main` when it (or
  `firebase.json`/`.firebaserc`) changes; `firebase-hosting-pull-request.yml` builds a
  preview channel for PRs that touch the same paths.
- **Trace logging.** `apps/glasses/src/logging/` (`trace.ts`) is the app-wide log sink —
  used by both `src/glasses/**` and `src/web/**`, shown in the Settings screen's debug
  console, and copyable for bug reports (see README's "Reporting a bug"). When you add a
  new screen, action, or fetch, add a `trace.info/warn/error('CAT', msg, ctx?)` call at
  its entry point and on its failure path — don't let a new `catch` swallow an error
  silently. Secrets are redacted automatically (`logging/redact.ts`); don't log the raw
  tenant token or `X-Notion-Config` header value outside `tenant-config.ts`.
- Glasses tests live in `apps/glasses/src/__tests__/**` (mirroring the source tree) and use
  the shared harness in `__tests__/glasses/harness.ts` + `fakes.ts`, not ad-hoc setup.

## Versions

`apps/glasses` and the glasses `app.json` version are bumped together (currently 2.5.1) —
use the `bump-glasses-version` skill. The server / root version tracks separately (2.0.4).
