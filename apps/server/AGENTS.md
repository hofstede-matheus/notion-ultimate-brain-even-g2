# AGENTS.md — apps/server

Guidance for AI agents working in `@notion-ub/server`. Repo-wide rules (testing contract,
commits, "server is a proxy", cross-app gotchas) live in the root
[AGENTS.md](../../AGENTS.md) — read that first. Keep this file short; add app-specific traps
here.

## What this is

The Notion API backend. A thin proxy: attach the tenant's token, call Notion, return the
response. Express locally, AWS Lambda (Function URL) in prod. Stores no credentials.

## Layout

- `src/routes.ts` — the route table, shared by both entry points.
- `src/express/` — local dev server (`index.ts`, port from `.env`, default 3210).
- `src/lambda/` — prod entry: `handler.ts`, `match-route.ts`, `logger.ts`.
- `src/mappers.ts` — shrinks Notion objects to list-row fields (the one allowed exception
  to "proxy only"). `views.ts` / `filters.ts` — list view queries. `tenant.ts` — header
  parsing. `notion-client.ts`, `config.ts`.
- `src/__tests__/` — unit tests.
- `terraform/` — Lambda + GitHub OIDC, Terraform Cloud backend (`versions.tf`).

## Commands (from repo root)

```bash
pnpm --filter @notion-ub/server dev            # tsx watch, Express :3210
pnpm --filter @notion-ub/server test           # unit
pnpm --filter @notion-ub/server mutation       # StrykerJS
pnpm --filter @notion-ub/server check-types
pnpm --filter @notion-ub/server build          # build:lambda (dist-lambda/) + build:express (dist/)
pnpm --filter @notion-ub/server tf:plan        # builds first; also tf:init, tf:apply
```

## Conventions

- **Route auth is per-route.** `Route.auth` defaults to `'tenant'` (full `X-Notion-Config`:
  token + all 4 DB ids). `'token'` requires only `X-Notion-Token` — for routes that run
  before DB ids are known (`GET /api/databases`). Use `authed()` / `tokenAuthed()` wrappers.
- **Logging is a privacy contract.** Successful requests log nothing; failures log only
  `{ method, route, status, errorCode? }` — `route` is the pattern (`/api/pages/:id`), never
  the raw path. No response bodies, error messages, or env var to widen this. See
  `src/lambda/logger.ts` and `apps/landing-page/legal.html` before changing it.
- **New or reshaped routes:** the glasses simulator suite uses a fixture server, not this
  app. If a glasses flow calls the route, mirror it in
  `apps/glasses/src/__integration__/fixture-server/server.ts` (`ROUTES`). A new filter or
  sort must also be listed in `packages/contracts/src/db-roles-requirements.ts`
  (`db-roles-drift.test.ts` fails otherwise).

## Deploy and version

`.github/workflows/deploy-lambda.yml` builds and applies on push to `main` when
`apps/server/**` changes. Not managed by release-please — the version stays manual.
