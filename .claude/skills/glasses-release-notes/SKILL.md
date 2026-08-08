---
name: glasses-release-notes
description: Draft plain-language release notes for the Even Hub store listing from the newest CHANGELOG entry. USE WHEN the user asks for release notes, store notes, or "what do I write for this release" for the glasses app. Does not touch versions — release-please owns those.
---

# Glasses Store Release Notes

Turns the newest `apps/glasses/CHANGELOG.md` entry into 1–3 short bullets a human can paste
into the Even Hub store listing.

**This skill never edits versions.** `apps/glasses/package.json`, `apps/glasses/app.json`,
`apps/glasses/CHANGELOG.md`, and `.release-please-manifest.json` are owned by release-please
(see [release-please-config.json](../../../release-please-config.json)). If the user asks to
bump a version, tell them the flow instead: land conventional commits on `main`, then merge
the `chore(glasses): release X.Y.Z` PR that release-please opens.

## Steps

1. Read the **topmost** version section of `apps/glasses/CHANGELOG.md` — the entries under the
   highest version heading, which is the release being written about. If the user names a
   specific version, use that section instead.

   If the file does not exist yet, or the top section is the one release-please is still
   proposing in an open PR, say so and offer to read the PR body instead.

2. Translate it into a **very brief, human, non-technical changelog** — 1–3 short bullet
   lines in plain everyday language.

   Drop anything the person installing the app cannot see: refactors, test changes, CI, type
   fixes, dependency work. If nothing user-visible remains, say so and suggest a single
   honest line like "Small fixes and improvements under the hood."

   Avoid jargon entirely: no "bump", "semver", "manifest", "dependency", "package.json",
   "app.json", file paths, commit hashes, PR numbers, scopes, or `feat:`/`fix:` prefixes.

   Example tone:

   - "Quick fixes for smoother task syncing."
   - "Polished the home screen and made voice capture a bit faster."
   - "You can now pick a due date right from a task."

3. Output the bullets on their own, ready to copy. Do not commit anything or edit any file
   unless the user explicitly asks.

## Notes

- `apps/glasses/app.json` is the Even Realities G2 hub manifest. Its `version` is kept in sync
  with `package.json` automatically by release-please's `extra-files` updater — the other
  fields (`package_id`, `edition`, `min_app_version`, `min_sdk_version`) are hand-maintained
  and must never be touched by an automated bump.
- The `.ehpk` for a release is attached as an asset to its GitHub Release
  (`gh release view glasses-vX.Y.Z`), built by `.github/workflows/build-ehpk.yml`.
