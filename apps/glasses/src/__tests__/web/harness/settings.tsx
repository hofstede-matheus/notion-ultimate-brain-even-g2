/**
 * Shared rendering + driving helpers for the Settings-screen component tests
 * (settingsForm.test.tsx, voiceSectionComponent.test.tsx, logConsole.test.tsx,
 * app.test.tsx). Follows statusScreen.test.tsx's harness shape: real
 * component tree, real providers, manual `cleanup()` (RTL's auto-cleanup
 * only self-registers when `test.globals` is on, which this repo doesn't
 * set — see CLAUDE.md's Gotchas). Not itself a test file — vitest's
 * `// @vitest-environment jsdom` pragma has no effect here; each importing
 * `.test.tsx` file carries its own.
 *
 * Each spec file still writes its own `vi.mock(...)` calls — those have to be
 * hoisted per-file by Vitest's transform and can't be shared through a
 * function here.
 */
import type { TenantConfig } from '@notion-ub/contracts';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AppProviders } from '../../../web/providers';
import { promptForConfig } from '../../../web/providers/uiController';

/**
 * even-toolkit's `Select` (node_modules/even-toolkit/dist/web/components/select.js) is not a
 * native `<select>` — it's a `<button>` trigger wrapped in `<div class="relative">`, with the
 * options portalled onto `document.body` on open. There is no listbox/option ARIA role, and
 * `userEvent.selectOptions` cannot drive it.
 *
 * Locating the *right* trigger by accessible name doesn't work either: before anything is
 * chosen every empty Select shares the same placeholder text, and once a value IS chosen the
 * trigger and its matching (highlighted) option share the same name while open. So instead we
 * find the trigger structurally, scoped to the `<div>` that wraps one field's `<label>` — the
 * Select's wrapping `div.relative > button` is the only button in that scope for the four
 * database fields; see `voiceModeTrigger` for the one exception (VoiceSection's mode selector
 * shares its wrapping div with mode-specific action buttons).
 */
export function fieldContainer(labelText: string | RegExp): HTMLElement {
  const label = screen.getByText(labelText);
  const container = label.closest('div');
  if (!container) throw new Error(`no wrapping <div> found for label "${labelText}"`);
  return container;
}

/** The Select trigger button for the field whose visible label is `labelText`. */
export function selectTrigger(labelText: string | RegExp): HTMLElement {
  const trigger =
    fieldContainer(labelText).querySelector<HTMLButtonElement>('div.relative > button');
  if (!trigger) throw new Error(`no Select trigger found near label "${labelText}"`);
  return trigger;
}

/**
 * VoiceSection wraps its mode `<label>` and `<Select>` in the same outer `<div>` as every
 * mode-specific action button ("Test key", "Download", "Cancel", "Remove"...), so
 * `selectTrigger` alone would match more than one button once a mode's content renders. The
 * mode Select is always the first (and only) `div.relative > button` in that scope regardless.
 */
export function voiceModeTrigger(): HTMLElement {
  return selectTrigger('Voice input');
}

/**
 * The open dropdown's portal container (`<div class="fixed z-[9999] ...">`, appended straight
 * to `document.body`, outside whatever `container` RTL scoped `render()` to). Once a Select has
 * a value, its trigger shows the same label as the matching option below it — searching the
 * whole document for that label finds both. Scoping to the portal is what makes the option
 * lookup unambiguous.
 */
export function dropdownPortal(): HTMLElement {
  const portal = document.body.querySelector<HTMLElement>(':scope > div.fixed');
  if (!portal) throw new Error('no open Select dropdown found on document.body');
  return portal;
}

/** Opens a Select and picks the option named `optionName`. */
export async function chooseOption(
  user: { click: (el: Element) => Promise<void> },
  labelText: string | RegExp,
  optionName: string | RegExp,
): Promise<void> {
  await user.click(selectTrigger(labelText));
  const option = within(dropdownPortal()).getByRole('button', { name: optionName });
  await user.click(option);
}

/**
 * Opens the Settings screen the way production code does — through the real
 * `promptForConfig` (web/providers/uiController.ts), not by faking `settingsOpen` — then
 * renders `ui` (typically `<SettingsForm/>`) under the real `AppProviders` nesting
 * (`UiStateProvider > LogProvider`, see web/providers/index.tsx) so `<LogConsole/>` works too
 * without a separate wrapper.
 *
 * `promptForConfig` unconditionally overwrites `settingsPrefill`/`settingsCancellable` on every
 * call, so calling this once per test is enough to avoid the cross-test leakage
 * `uiController`'s module-level store would otherwise cause — no separate reset needed for
 * those two fields. `settingsOpen` itself is reset by each spec's `afterEach` calling
 * `cancelSettings()` (see each file), which also resolves any promise this left pending.
 */
export function renderSettingsScreen(
  ui: ReactElement,
  opts: { prefill?: TenantConfig | null; cancellable?: boolean } = {},
) {
  promptForConfig(opts.prefill ?? null, opts.cancellable ?? false);
  return render(<AppProviders>{ui}</AppProviders>);
}
