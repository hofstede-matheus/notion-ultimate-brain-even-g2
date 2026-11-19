# AGENTS.md — apps/glasses

Guidance for AI agents working in `@notion-ub/glasses`. Repo-wide rules (testing contract,
commits, versions, cross-app gotchas) live in the root [AGENTS.md](../../AGENTS.md) — read
that first. Keep this file short; add app-specific traps here.

## What this is

The Even Realities G2 app: one Vite build with two front ends — the glasses UI (Even Hub
SDK) and a React phone webview for status + Settings. Packaged as an `.ehpk`.

## Layout

- `src/glasses/` — glasses UI. `router.ts` (screen table), `events/` (input → action),
  `render/` (SDK containers), `modules/{tasks,notes,projects,tags}` over `modules/_shared/`
  (list screens, pagination, page reader, project picker, item actions), `bitmap/` (1-bit
  BMP + 5×7 font for the calendar), `content/` (markdown → reader pages).
- `src/web/` — React 19 + Tailwind v4 webview: `providers/` · `hooks/` · `services/` ·
  `components/` · `screens/`.
- `src/` root — shared plumbing: `api.ts`, `state.ts`, `cache.ts`, `page-loader.ts`,
  `stt/`, `voice-config.ts`, `voice-model.ts`, `voice-runtime.ts`, `tenant-config.ts`,
  `boot.ts`, `logging/`.
- `src/__tests__/` — unit tests, mirroring the source tree.
- `src/__integration__/` — simulator e2e suite. Read its [README](src/__integration__/README.md)
  before adding a spec.

## Commands (from repo root)

```bash
pnpm --filter @notion-ub/glasses dev                # Vite :5173 (proxies /api/* to :3210)
pnpm --filter @notion-ub/glasses sim                # simulator 0.9.3, needs dev running
pnpm --filter @notion-ub/glasses qr                 # QR for a real device on the LAN
pnpm --filter @notion-ub/glasses test               # unit
pnpm --filter @notion-ub/glasses test:integration   # simulator e2e
pnpm --filter @notion-ub/glasses mutation           # StrykerJS
pnpm --filter @notion-ub/glasses check-types
pnpm --filter @notion-ub/glasses pack               # build + .ehpk
pnpm --filter @notion-ub/glasses fetch:voice-model  # Vosk model → dist-model/ (publishing only)
```

Env (see `.env.example`): `VITE_API_BASE` goes in `.env.production` (baked in at build).
`VITE_NOTION_*` in `.env.local` auto-fill Settings under `vite dev` only.

## Testing

- Unit tests use `src/__tests__/glasses/harness.ts` + `fakes.ts`, not ad-hoc setup.
- The mocked bridge accepts everything; only the simulator suite proves the SDK accepts a
  payload and paints it.
- UI changes: look at them with the `simulator-debug` skill, don't just test them.

## Conventions

- **Page-level actions are generic over tasks and notes.** `modules/_shared/item-actions.ts`
  runs one confirm→toast flow for markDone/delete/setDue/setProject. Add a new item action
  there, not per-module.
- **Trace logging.** `src/logging/trace.ts` is the app-wide log sink. Add
  `trace.info/warn/error('CAT', msg, ctx?)` at entry points and failure paths for new
  screens, actions, and fetches. The Settings debug console is behind ten taps on the
  version label (session-only unlock; always visible in `vite dev`). Don't log the raw
  tenant token or `X-Notion-Config` outside `tenant-config.ts` (secrets are redacted
  automatically).

## Gotchas

- **Integration Today fixtures must be date-relative.** The Today screen filters
  `dueDate === todayDateStr()` client-side — `__integration__/fixtures.ts` must use
  `format(addDays(new Date(), n), 'yyyy-MM-dd')` (local calendar), never a literal
  `YYYY-MM-DD` or `toISOString()`, or the suite goes red the next day.
- **G2 lists:** `MAX_LIST_ITEMS` 20, `MAX_ITEM_BYTES` 63 **UTF-8 bytes** (not JS chars).
  One oversized item rejects the whole rebuild (`glasses/constants.ts`).
- **G2 containers:** names+IDs are lifetime-stable (≤16 chars) and matched against the first
  `createStartUpPageContainer`. A container dropped from a rebuild cannot be re-added — id=2
  is a 1×1 placeholder on text-only screens for that reason. Calendar image containers are
  the exception (4-container cap). Don't switch bitmaps to PNG: 1-bit PNG renders solid
  green; use `glasses/bitmap/bmp.ts`.
- **Reader pages must not overflow.** Leftover overflow re-arms firmware scroll and swallows
  swipes (`READER_LINES_PER_PAGE` / `READER_CHARS_PER_LINE`).
- **Speech:** `src/stt/` façades Vosk (on-device) and Soniox (cloud) over a shared session.
  Modes are exclusive; the Soniox key lives in `voice-config.ts`, never `TenantConfig`. The
  Vosk model is a runtime download, not packed. Optional language hints from Settings
  (empty = auto-detect). Don't "simplify" the Soniox close: empty **text** frame +
  `finalize` (binary empty is dropped), one socket per recording, batch 10 ms frames on the
  wire.
- **Web component-level tests are `.test.tsx`, not `.test.ts`.** Most of `__tests__/web/**`
  tests pure logic under the default `node` environment; a test that renders a real React
  tree (e.g. `statusScreen.test.tsx`) needs a `// @vitest-environment jsdom` docblock at the
  top of the file instead, and must call `@testing-library/react`'s `cleanup()` itself in
  `afterEach` — its own auto-cleanup only self-registers when `test.globals: true`, which
  this repo doesn't set. `vitest.config.ts` also inlines `even-toolkit`
  (`server.deps.inline`): left externalized, Vitest's SSR runner loads it via plain Node
  `import()`, which can't resolve its extensionless relative imports and throws
  `Cannot find module` for any file rendering `even-toolkit/web/*`.

## Versions

Never edit `package.json`/`app.json` versions or `CHANGELOG.md` by hand — release-please owns
them. See **Versions** in the root [AGENTS.md](../../AGENTS.md).
