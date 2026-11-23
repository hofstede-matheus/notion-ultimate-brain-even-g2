# AGENTS.md

Guidance for AI agents working in this repo. Keep it short and current; when you learn
something an agent would trip on, add it here. For the full narrative (what the app does,
deploy details), see [README.md](README.md).

## What this is

A GTD task manager for Even Realities G2 smart glasses, backed by Notion. Turborepo +
pnpm-workspaces monorepo. Multi-tenant: each device sends its own Notion token + database
IDs via the `X-Notion-Config` header; the server stores no credentials.

## Layout

Each app has its own `AGENTS.md` (`apps/glasses/`, `apps/server/`, `apps/landing-page/`)
with its layout, commands, conventions and gotchas. Read it before working in that app.

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
- `.rulesync/` — source of truth for agent skills and hooks (`rulesync.jsonc`). Edit there,
  then `pnpm rulesync:generate`; `.claude/skills`, `.kilo/`, `.cursor/` outputs are generated
  (gitignored, also regenerated on `pnpm install`). `.claude/settings.json` is generated but
  committed.
- `docs/features/` — Gherkin specs of user-facing flows (documentation only, no runner).
  Read the relevant `.feature` file before changing behaviour it describes; update it in
  the same change if the behaviour moves. See [docs/README.md](docs/README.md).

## Commands (run from repo root; turbo fans out)

```bash
pnpm install
pnpm dev            # Express :3210 + Vite :5173 (proxies /api/* to server)
pnpm test           # unit (turbo) then glasses simulator e2e; needs a desktop session
pnpm check-types    # tsc --noEmit across workspaces
pnpm lint           # biome check .
pnpm lint:fix       # biome check --write .
pnpm build          # server → esbuild lambda bundle; glasses → Vite dist/
```

Scope to one workspace with `pnpm --filter @notion-ub/server <task>` /
`--filter @notion-ub/glasses <task>`. Package the `.ehpk` with
`pnpm --filter @notion-ub/glasses pack`. Simulator (pinned to
`@evenrealities/evenhub-simulator@0.9.3` — container caps are version-specific):
`pnpm --filter @notion-ub/glasses sim`, with `pnpm dev` on :5173. `sim` has no
automation port; for headless inspection use the `simulator-debug` skill.

## Testing

```bash
pnpm test              # unit (turbo) then glasses simulator e2e, ~1 min extra; needs a desktop session
pnpm test:integration  # simulator suite only — same e2e as the second half of pnpm test
pnpm mutation          # StrykerJS — unit-test quality on pure logic; slow, local-only
pnpm lint              # biome check .
pnpm check-types       # tsc --noEmit
```

**Finishing a change means running all four.** Report what actually
happened — a suite you did not run is not a suite that passed, and "should
pass" is not a result. `pnpm mutation` is local-only (not CI); run it at the
end of a task. CI runs unit tests in `verify` via `turbo run test` (not root
`pnpm test`, so the simulator is not folded into that job) and runs
`pnpm test:integration` in a dedicated `integration` job (Xvfb on
ubuntu-latest). CI skips both `verify` and `integration` on release-please PRs
(branch name, label, or release commit subject); `integration` also runs only
when a git diff touches glasses source, `packages/**`, lockfiles, or
`.github/workflows/ci.yml` (skipped jobs report success — not a failure).

- **Every change ships unit tests**, in the same change as the behaviour.
  Glasses tests live in `apps/glasses/src/__tests__/**` and use
  `__tests__/glasses/harness.ts` + `fakes.ts`, not ad-hoc setup.
- **Every fix ships a regression test** in the unit suite. Write it so it
  fails against the unfixed code — a regression test that passes before the
  fix is testing nothing.
- **Integration tests are for high-level flows only.** They drive the real
  simulator (`apps/glasses/src/__integration__/`), so they are slow and few.
  Add one only when a change introduces or reshapes a whole user-facing
  flow — a new screen tree, a new mutation round trip, a new render mode
  (list → bitmap → reader). Every change should *consider* whether one is
  warranted; most correctly conclude no. See
  `apps/glasses/src/__integration__/README.md`.
- **Never update a test to make it pass.** A failing test is a finding, not
  an obstacle. Change a test only when the behaviour it describes was
  deliberately changed, and say so in the commit body. Deleting a case,
  adding `.skip`, loosening an assertion, or widening a matcher to reach
  green is not allowed. If a test looks wrong, say so and stop — do not
  quietly rewrite it.
- **A UI change gets looked at, not just tested.** Tests confirm the data
  and screen logic are right; they don't confirm anything actually painted.
  Use the `simulator-debug` skill (`.claude/skills/simulator-debug/SKILL.md`)
  to launch the app, drive it (tap/swipe/back via the automation API), and
  `Read` the resulting screenshots yourself before calling a glasses-screen
  or webview change done.
- **Mutation testing scores the unit suite, not the product.** Scope is
  deliberately narrow — it is slow and CPU-heavy, so only logic where a
  silent bug corrupts data or leaks secrets is mutated: reader pagination
  (`markdown-to-pages.ts`, `pagination.ts`), input resolution
  (`events/resolve.ts`), calendar date math (`month-grid.ts`), cache/page
  loading, DB-role selection (`dbSelection.ts`, `db-roles.ts`), log
  redaction, and the server's mappers/filters/tenant parsing/routing.
  Rendering (`bitmap/*`, `screen-factories.ts`), log formatting/export,
  settings-form helpers, glue code, constant tables and `.tsx` are out of
  scope — they are covered by unit tests and by looking at the simulator.
  Don't add a file to `mutate` unless it meets that bar. Glasses sets
  `ignoreStatic`: module-level mutants force the whole suite per mutant
  (~65% of the run) and only hit constant tables. It also runs
  `incremental`: results for unchanged code and tests are reused from
  `reports/stryker-incremental.json` (gitignored), so a re-run costs about
  the dry run plus the touched mutants. Pass `--force` to
  `pnpm --filter @notion-ub/glasses mutation` for a full run, e.g. after a
  dependency bump. Each workspace's
  `thresholds.break` is a ratchet: raise it as holes are closed, never
  lower it to make a run green.

## Conventions

- **Server is a proxy; the client decides.** A handler attaches the tenant token, calls
  Notion, and returns the response — nothing more. Parsing, formatting, display pagination,
  and caching run on the device. The deliberate exception is `src/mappers.ts`, which shrinks
  Notion objects to list-row fields to cut payload size. Don't add business logic to the
  server without a payload/latency reason.
- **Formatting/linting is Biome** (`biome.json`). **TypeScript strict** everywhere. No new
  `any`. Run `pnpm lint` before finishing.
- **Commits and PR titles are Conventional Commits** — drives the release (see **Versions**).
  `type(scope): description`: scope is the feature area (`tasks`, `notes`, `projects`,
  `tags`, `glasses`, `server`, `landing-page`, `contracts`), description imperative,
  lowercase, no trailing period, ≤ 72 chars. PRs are squash-merged, so the PR title is the
  commit on `main` (linted by `pr-title.yml`; commits by `.husky/commit-msg`). PR bodies are
  prose on what changed and why, not a file-by-file diff.
- **Testing rules** (what needs a test, unit vs. integration, never edit a
  test to force it green) are in the **Testing** section above.
- Never commit without explicit user consent for that specific commit.
- **Out-of-scope findings become GitHub issues.** If an investigation or
  in-progress task turns up a real problem that is not part of the current
  change, do not silently drop it and do not expand the change to fix it.
  Open a GitHub issue on this repo that explains the problem in detail
  (what you saw, where, why it matters, how to reproduce). Then stay on
  the original task.

## Gotchas

- **Notion status/type names are option names, not group labels.** Tasks: `Done`
  (not "Complete"); Projects: `Doing`/`Ongoing` (not "In progress"); Tags Type:
  `Area`/`Resource`/`Entity`. Group labels silently match nothing.
- **Duplicate database titles.** Settings disambiguates via
  `packages/contracts/src/db-roles-requirements.ts` (`ROLE_REQUIREMENTS`). Keep that table in sync with
  `views.ts`/`routes.ts`/`mappers.ts` — `db-roles-drift.test.ts` fails if a new filter or
  sort isn't listed.

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
