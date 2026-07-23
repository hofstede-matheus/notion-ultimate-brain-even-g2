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
  - `src/glasses/` — on-glasses UI via the Even Realities SDK. Structure: `router.ts`,
    `menu.ts`, `content/` (page reader, `markdown-to-pages.ts`), `render/`, `events/`,
    `modules/` (`tasks`, `notes`, `projects`, `tags`, `_shared`).
  - `src/web/` — React 19 + Tailwind v4 phone webview (`App.tsx`, `screens/` StatusScreen
    + SettingsForm). This is where the tenant config lives; `tenant-config.ts` holds it.
- `apps/server` (`@notion-ub/server`) — Notion API backend. `src/routes.ts` is a
  framework-agnostic route table shared by two entry points: `src/express/index.ts` (local
  dev) and `src/lambda/handler.ts` (prod, esbuild → `dist-lambda/`, deployed via Terraform
  in `terraform/`). Helpers: `notion-client.ts`, `mappers.ts`, `filters.ts`, `views.ts`,
  `tenant.ts`, `config.ts`.
- `packages/contracts` (`@notion-ub/contracts`) — shared types (Task, Note, Project, Tag,
  TenantConfig, Notion page shapes). Import cross-app types from here, not by reaching into
  another app.
- `packages/typescript-config` — `base.json` + `dom.json` (glasses) + `node.json` (server).

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
`pnpm --filter @notion-ub/glasses pack`.

## Conventions

- **Server is a proxy; the client decides.** A handler attaches the tenant token, calls
  Notion, and returns the response — nothing more. Parsing, formatting, display pagination,
  and caching run on the device (the phone is free; Lambda time is billed). The deliberate
  exception is `src/mappers.ts`, which shrinks Notion objects to list-row fields to cut
  payload size. Don't add business logic to the server without a payload/latency reason.
- **Formatting/linting is Biome** (`biome.json`), not ESLint/Prettier. Run `pnpm lint`
  before finishing.
- **TypeScript strict** everywhere via the shared config. No new `any`.
- Never commit without explicit user consent for that specific commit.

## Gotchas

- **Notion status filters need the real option name, not the group label.** Tasks use
  `Done` (not "Complete"); Projects use `Doing`/`Ongoing` (not "In progress"). Group labels
  silently match nothing.
- **Byte-vs-char truncation.** The glasses display truncates by display width; watch the
  byte-vs-char distinction when cutting strings for the SDK. See
  `apps/glasses/src/glasses/` render code.
- The offline voice model isn't in git. `pnpm dev`/`build` expect
  `apps/glasses/public/vosk/model.tar.gz`; fetch it with
  `pnpm --filter @notion-ub/glasses fetch:voice-model`.
- CI (`.github/workflows/ci.yml`) runs lint + `turbo run check-types test build` on PRs to
  `main`. `deploy-lambda.yml` and `build-ehpk.yml` deploy on push to `main` when the
  respective app changes.

## Versions

`apps/glasses` and the glasses `app.json` version are bumped together (currently 2.3.0) —
use the `bump-glasses-version` skill. The server / root version tracks separately (2.0.4).
