# Copilot instructions

Read [CLAUDE.md](../CLAUDE.md) first — it describes what this repo is, its layout, its
commands, and its conventions. Everything there applies to you too. This file adds the rules
about how work is committed and proposed.

## Commits and PR titles must be Conventional Commits

Releases are automated. [release-please](https://github.com/googleapis/release-please) reads
the commits on `main` to decide the next glasses version, write
`apps/glasses/CHANGELOG.md`, and cut the GitHub Release. A commit it cannot parse is silently
dropped from the release notes and never bumps a version.

PRs are **squash-merged**, so the **PR title becomes the commit message on `main`**. The PR
title is the thing that actually matters — it is linted in CI by
[`.github/workflows/pr-title.yml`](workflows/pr-title.yml) and a non-conforming title blocks
the merge.

Format:

```
type(scope): description
```

- **type** — one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- **scope** — optional, lowercase. Use the feature area, not the package name:
  `tasks`, `notes`, `projects`, `tags`, `glasses`, `server`, `landing-page`, `contracts`.
- **description** — imperative mood, lowercase, no trailing period, ≤ 72 characters.
  Write "add", not "added" or "adds".
- **breaking changes** — append `!` after the type/scope (`feat(notes)!: ...`) and add a
  `BREAKING CHANGE: <what broke>` footer.

Which type to pick, since it drives the version number:

- `feat` → minor bump. A new capability the user can see.
- `fix` → patch bump. A user-visible bug is gone.
- everything else → no bump. Refactors, tests, docs, CI, dependency chores.

Good:

```
feat(tasks): add due-date picker to the task detail screen
fix(glasses): stop swallowing swipes on overflowing reader pages
refactor(server): fold filter building into views.ts
docs: describe the release flow
```

Bad — these will be rejected:

```
Initial plan
Update task details
Fixed a bug.
feat: Add Due Date Picker
```

Individual commits inside a PR are also linted locally by `.husky/commit-msg`, so use the
same format for every commit you make, not just the PR title.

## Pull request bodies

Say what changed and why in prose. Do not restate the diff file by file. If the change moves
behaviour that a `docs/features/*.feature` spec describes, update that spec in the same PR
and say so in the body.

## Never bump versions by hand

`apps/glasses/package.json` and `apps/glasses/app.json` versions, `apps/glasses/CHANGELOG.md`,
and `.release-please-manifest.json` are all owned by release-please. Do not edit them.
