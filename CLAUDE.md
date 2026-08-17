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

## Testing

```bash
pnpm test              # unit — vitest in both apps and contracts, fast
pnpm test:integration  # glasses end-to-end in the simulator, ~1 min; local needs a desktop session (CI runs this in a separate job)
pnpm mutation          # StrykerJS — unit-test quality on pure logic; slow, local-only
pnpm lint              # biome check .
pnpm check-types       # tsc --noEmit
```

**Finishing a change means running all four.** Report what actually
happened — a suite you did not run is not a suite that passed, and "should
pass" is not a result. `pnpm mutation` is local-only (not CI); run it at the
end of a task. CI also runs `pnpm test:integration` in a dedicated
`integration` job (Xvfb on ubuntu-latest); that is not part of the four local
commands above — run it locally when you touch simulator-facing flows.

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
  pure logic only — SDK/HTTP glue (`api.ts`, `glasses/render/*`, `boot.ts`),
  constant tables (`glasses/constants.ts`, `views.ts`, `db-roles-requirements.ts`,
  `font5x7-glyphs.ts`, `soniox-language-codes.ts`, `event-type-names.ts`), `.tsx` components, and known
  coverage gaps (`tenant-config.ts`, `logging/trace.ts`) are excluded so
  survivors stay signal. Each workspace's `thresholds.break` is a ratchet:
  raise it as holes are closed, never lower it to make a run green.

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
- **Testing rules** (what needs a test, unit vs. integration, never edit a
  test to force it green) are in the **Testing** section above.
- **Server logging is a privacy contract.** Successful requests log nothing; failures log only
  `{ method, route, status, errorCode? }` — `route` is the pattern (`/api/pages/:id`), never
  the raw path. No response bodies, error messages, or env var to widen this. See
  `apps/server/src/lambda/logger.ts` and `legal.html` before changing it.
- Never commit without explicit user consent for that specific commit.
- **Out-of-scope findings become GitHub issues.** If an investigation or
  in-progress task turns up a real problem that is not part of the current
  change, do not silently drop it and do not expand the change to fix it.
  Open a GitHub issue on this repo that explains the problem in detail
  (what you saw, where, why it matters, how to reproduce). Then stay on
  the original task.

## Gotchas

- **Integration Today fixtures must be date-relative.** The Today screen filters
  `dueDate === todayDateStr()` client-side — `__integration__/fixtures.ts` must
  use `fixtureIsoDate()`, not a literal `YYYY-MM-DD`, or the suite goes red the
  next calendar day.
- **Notion status/type names are option names, not group labels.** Tasks: `Done`
  (not "Complete"); Projects: `Doing`/`Ongoing` (not "In progress"); Tags Type:
  `Area`/`Resource`/`Entity`. Group labels silently match nothing.
- **Duplicate database titles.** Settings disambiguates via
  `packages/contracts/src/db-roles-requirements.ts` (`ROLE_REQUIREMENTS`). Keep that table in sync with
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
