# AGENTS.md — apps/landing-page

Guidance for AI agents working in `@notion-ub/landing-page`. Repo-wide rules live in the
root [AGENTS.md](../../AGENTS.md); how the site was derived is in [README.md](README.md).
Keep this file short; add app-specific traps here.

## What this is

A static, script-free marketing site plus the privacy policy & terms (`legal.html`, served
at `/legal`). Not part of the Node build/test/check-types graph — there are no tests here.

## Commands (from repo root)

```bash
pnpm --filter @notion-ub/landing-page dev     # serve on :3000
pnpm --filter @notion-ub/landing-page build   # copies files into dist/
```

## Gotchas

- **`css/entry.css` is a compiled bundle — you can't invent Tailwind classes.** It only has
  the utilities the original site used. Grep it before relying on a class; add anything
  missing to `css/static.css` (the only hand-written stylesheet).
- **Cascade order matters.** Every page carries the same six `<link>` tags in the same
  order (`inline-a`, sheets, `inline-b`, `static`). Don't reorder them.
- **`build` names HTML files literally.** A new page not added to the `build` script never
  reaches `dist/`, and the deploy still succeeds. Pages stay at the app root (asset paths
  are relative).
- **No JavaScript.** Dark mode is hardcoded as `class="dark"` on `<html>`; removing it
  renders the page light.
- **`legal.html` is a public promise.** It describes what the code actually stores, logs,
  and sends. If a change elsewhere alters that (e.g. server logging), update it in the same
  change.

## Deploy and version

Firebase Hosting site `notion-ub-landing` (`firebase.json`, `.firebaserc`).
`.github/workflows/deploy-landing.yml` deploys on push to `main`; PRs get a preview channel
via `firebase-hosting-pull-request.yml`. Not managed by release-please — the version stays
manual.
