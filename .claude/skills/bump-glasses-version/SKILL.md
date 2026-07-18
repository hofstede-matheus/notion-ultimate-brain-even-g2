---
name: bump-glasses-version
description: Bump the version of the glasses app. USE WHEN the user asks to bump/release/version the glasses app (e.g. "bump version", "bump glasses version", "release the glasses app"). Asks whether to bump patch, minor, or major, then updates the version field in apps/glasses/app.json and apps/glasses/package.json only.
---

# Bump Glasses App Version

Updates the `version` field in **only these two files**:

- `apps/glasses/app.json`
- `apps/glasses/package.json`

These two must always stay in sync with each other. Do **not** touch the root `package.json`, `apps/server`, or any other file.

## Steps

1. Read the current `version` from `apps/glasses/package.json` and cross-check it against `version` in `apps/glasses/app.json`. If they differ, tell the user about the mismatch and ask which value is authoritative before continuing.
2. Compute the three candidate next versions from the current `MAJOR.MINOR.PATCH`:
   - **patch** → `X.Y.(Z+1)`
   - **minor** → `X.(Y+1).0`
   - **major** → `(X+1).0.0`
3. Ask the user which bump to apply using AskUserQuestion, with patch/minor/major as options and the resulting version number shown for each (e.g. "patch — 2.0.7").
4. Update the `version` field to the chosen value in both:
   - `apps/glasses/app.json`
   - `apps/glasses/package.json`

   Change only the `version` field — leave every other field (`package_id`, `edition`, `min_app_version`, `min_sdk_version`, dependencies, etc.) untouched.
5. Report the old → new version change. Do not commit, tag, or push — leave that to the user unless they explicitly ask for it.

## Notes

- `apps/glasses/app.json` is the Even Realities G2 hub manifest (alongside `package_id`, `edition`, `min_app_version`, `min_sdk_version`) — its `version` is a plain semver string like `"2.0.6"`.
- The root `package.json` version and `apps/server` version are independent and must never be changed by this skill.
