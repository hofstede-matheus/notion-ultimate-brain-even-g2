# CLAUDE.md

Guidance for AI agents working in this repo. Keep it short and current; when you learn
something an agent would trip on, add it here. For the full narrative (what the app does,
deploy details), see [README.md](README.md).

## What this is

A GTD task manager for Even Realities G2 smart glasses, backed by Notion. Turborepo +
pnpm-workspaces monorepo. Multi-tenant: each device sends its own Notion token + database
IDs via the `X-Notion-Config` header; the server stores no credentials.

## Layout

- `apps/glasses` (`@notion-ub/glasses`) — Vite app with two front ends in one build:
  `src/glasses/` (Even Realities SDK UI), `src/web/` (React settings webview), and shared
  plumbing at `src/` root (`api.ts`, `state.ts`, `cache.ts`, `page-loader.ts`, `stt/`,
  `voice-config.ts`, `voice-model.ts`, `voice-runtime.ts`, `tenant-config.ts`, `boot.ts`,
  `logging/`).
- `apps/server` (`@notion-ub/server`) — Notion API backend. `src/routes.ts` is shared by
  `src/express/index.ts` (local dev) and `src/lambda/handler.ts` (prod, esbuild →
  `dist-lambda/`, Terraform in `terraform/`).
- `apps/landing-page` (`@notion-ub/landing-page`) — static marketing site; not part of the
  Node build/test/check-types graph. See its [README](apps/landing-page/README.md).
- `packages/contracts` (`@notion-ub/contracts`) — shared types. Import cross-app types
  from here, not by reaching into another app.
- `packages/typescript-config` — `base.json` + `dom.json` (glasses) + `node.json` (server).
- `docs/features/` — Gherkin specs of user-facing flows (documentation only, no runner).
  Read the relevant `.feature` file before changing behaviour it describes; update it in
  the same change if the behaviour moves. See [docs/README.md](docs/README.md).

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
`--filter @notion-ub/glasses <task>`. Package the `.ehpk` with
`pnpm --filter @notion-ub/glasses pack`. Simulator (pinned to
`@evenrealities/evenhub-simulator@0.8.0` — container caps are version-specific):
`pnpm --filter @notion-ub/glasses sim`, with `pnpm dev` on :5173. `sim` has no
automation port; for headless inspection use the `simulator-debug` skill.

## Conventions

- **Server is a proxy; the client decides.** A handler attaches the tenant token, calls
  Notion, and returns the response — nothing more. Parsing, formatting, display pagination,
  and caching run on the device. The deliberate exception is `src/mappers.ts`, which shrinks
  Notion objects to list-row fields to cut payload size. Don't add business logic to the
  server without a payload/latency reason.
- **Route auth is per-route.** `Route.auth` defaults to `'tenant'` (full `X-Notion-Config`:
  token + all 4 DB ids). `'token'` requires only `X-Notion-Token` — for routes that run
  before DB ids are known (`GET /api/databases`). Use `authed()` / `tokenAuthed()` wrappers.
- **Page-level actions are generic over tasks and notes.** On the client,
  `modules/_shared/item-actions.ts` runs one confirm→toast flow for
  markDone/delete/setDue/setProject. Add a new item action there, not per-module.
- **Formatting/linting is Biome** (`biome.json`). **TypeScript strict** everywhere. No new
  `any`. Run `pnpm lint` before finishing.
- **Commits and PR titles are Conventional Commits** — drives the release (see **Versions**).
  Full rules in [.github/copilot-instructions.md](.github/copilot-instructions.md).
- **Trace logging.** `apps/glasses/src/logging/trace.ts` is the app-wide log sink. Add
  `trace.info/warn/error('CAT', msg, ctx?)` at entry points and failure paths for new
  screens, actions, and fetches. The Settings debug console is behind ten taps on the
  version label (session-only unlock; always visible in `vite dev`). Don't log the raw
  tenant token or `X-Notion-Config`
  outside `tenant-config.ts` (secrets are redacted automatically).
- **Glasses tests** live in `apps/glasses/src/__tests__/**` and use
  `__tests__/glasses/harness.ts` + `fakes.ts`, not ad-hoc setup.
- **Server logging is a privacy contract.** Successful requests log nothing; failures log only
  `{ method, route, status, errorCode? }` — `route` is the pattern (`/api/pages/:id`), never
  the raw path. No response bodies, error messages, or env var to widen this. See
  `apps/server/src/lambda/logger.ts` and `legal.html` before changing it.
- Never commit without explicit user consent for that specific commit.

## Gotchas

- **Notion status/type names are option names, not group labels.** Tasks: `Done`
  (not "Complete"); Projects: `Doing`/`Ongoing` (not "In progress"); Tags Type:
  `Area`/`Resource`/`Entity`. Group labels silently match nothing.
- **Duplicate database titles.** Settings disambiguates via
  `packages/contracts/src/db-roles.ts` (`ROLE_REQUIREMENTS`). Keep that table in sync with
  `views.ts`/`routes.ts`/`mappers.ts` — `db-roles-drift.test.ts` fails if a new filter or
  sort isn't listed.
- **G2 lists:** `MAX_LIST_ITEMS` 20, `MAX_ITEM_BYTES` 63 **UTF-8 bytes** (not JS chars).
  One oversized item rejects the whole rebuild (`glasses/constants.ts`).
- **G2 containers:** names+IDs are lifetime-stable (≤16 chars) and matched against the first
  `createStartUpPageContainer`. A container dropped from a rebuild cannot be re-added — id=2
  is a 1×1 placeholder on text-only screens for that reason. Calendar image containers are
  the exception (4-container cap). Don't switch bitmaps to PNG: 1-bit PNG renders solid green;
  use `glasses/bitmap/bmp.ts`.
- **Reader pages must not overflow.** Leftover overflow re-arms firmware scroll and swallows
  swipes (`READER_LINES_PER_PAGE` / `READER_CHARS_PER_LINE`).
- **Speech:** `src/stt/` façades Vosk (on-device) and Soniox (cloud) over a shared session.
  Modes are exclusive; the Soniox key lives in `voice-config.ts`, never `TenantConfig`. The
  Vosk model is a runtime download, not packed. Optional language hints from Settings (empty
  = auto-detect). Don't "simplify" the Soniox close: empty **text** frame + `finalize` (binary
  empty is dropped), one socket per recording, batch 10 ms frames on the wire.

## Versions

**Never edit a glasses version by hand.** `apps/glasses/package.json`, `app.json`,
`CHANGELOG.md`, and `.release-please-manifest.json` are owned by release-please. Read the
current version from the manifest, not from prose. `feat` → minor, `fix` → patch,
`feat!`/`BREAKING CHANGE:` → major.

Traps:

- release-please only counts commits touching `apps/glasses/**`. A user-visible change made
  entirely in `packages/contracts` won't trigger a release — pair it with a glasses-side
  commit, or add a `Release-As: X.Y.Z` footer.
- `app.json` is updated through an `extra-files` **jsonpath** updater (`$.version`), not a
  regex — don't switch it to the `generic` updater.
- **`apps/glasses/app.json` is exempt from the Biome formatter** (`overrides` in
  `biome.json`). release-please rewrites it via `JSON.stringify`, which expands
  `"supported_languages"` over three lines; Biome would collapse it and fail `pnpm lint`.
  Don't re-collapse that array or remove the override.
- `.ehpk` builds chain from release-please via `workflow_call` on `build-ehpk.yml` — a tag
  pushed by `GITHUB_TOKEN` does not start new workflow runs.

`apps/server`, the root `package.json`, and `apps/landing-page` are not managed by
release-please — their versions stay manual.
