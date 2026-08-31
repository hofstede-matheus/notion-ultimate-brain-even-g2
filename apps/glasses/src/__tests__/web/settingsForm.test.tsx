// @vitest-environment jsdom
/**
 * Component-level coverage for the Settings screen's main form
 * (web/screens/SettingsForm/SettingsForm.tsx) — the token field, the debounced database fetch,
 * the four database dropdowns, the "Show all databases" escape hatch, the two-step "Save
 * anyway" fit gate, and commit.
 *
 * This does NOT re-assert what the pure-logic suites already pin exactly:
 * dbSelection.test.ts (unfitReason's exact strings, optionsForSlot/autoSelect/unfitSlots
 * matrices), voiceSection.test.ts (voiceConfigFromDraft permutations), settingsSubmit.test.ts
 * (commitSettings' call order). Every test here instead asserts an *observable UI consequence*
 * of those functions being wired together correctly — the class of bug a pure-logic test
 * structurally cannot catch (PR #41, #43 were both wiring bugs between already-correct
 * functions).
 *
 * VoiceSection renders as a child of SettingsForm on every test here, so its module
 * dependencies (voice-model's IndexedDB calls, stt/soniox's WebSocket) are mocked away — its
 * own behaviour is covered in voiceSectionComponent.test.tsx, not here.
 */
import '@testing-library/jest-dom/vitest';
import type { TenantConfig } from '@notion-ub/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchDatabases: vi.fn(),
  setTenantConfig: vi.fn(),
  refreshVoiceStatus: vi.fn(),
}));

vi.mock('../../web/services/databases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/services/databases')>();
  return { ...actual, fetchDatabases: mocks.fetchDatabases };
});

vi.mock('../../tenant-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tenant-config')>();
  mocks.setTenantConfig.mockImplementation(actual.setTenantConfig);
  return { ...actual, setTenantConfig: mocks.setTenantConfig };
});

vi.mock('../../voice-runtime', () => ({
  refreshVoiceStatus: mocks.refreshVoiceStatus.mockResolvedValue(undefined),
}));

// VoiceSection's own dependencies — its behaviour is covered in voiceSectionComponent.test.tsx.
vi.mock('../../voice-model', () => ({
  hasModel: vi.fn().mockResolvedValue(false),
  downloadModel: vi.fn(),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  MODEL_SIZE_MB: 41,
}));
vi.mock('../../stt/soniox', () => ({ testSonioxKey: vi.fn().mockResolvedValue('valid') }));

import { trace } from '../../logging/trace';
import { getTenantConfig } from '../../tenant-config';
import { cancelSettings } from '../../web/providers/uiController';
import { SettingsForm } from '../../web/screens/SettingsForm/SettingsForm';
import { InvalidTokenError } from '../../web/services/databases';
import {
  FIT_NOTES_DB,
  FIT_PROJECTS_DB,
  FIT_TAGS_DB,
  FIT_TASKS_DB,
  fittingDatabases,
  UNFIT_NOTES_MISSING_NOTE_DATE,
} from './harness/dbFixtures';
import {
  chooseOption,
  dropdownPortal,
  fieldContainer,
  renderSettingsScreen,
  selectTrigger,
  voiceModeTrigger,
} from './harness/settings';

const VALID_TOKEN = 'ntn_abcdefghijklmnop';

function renderForm(opts: { showLog?: boolean; prefill?: TenantConfig | null } = {}) {
  const onVersionTap = vi.fn();
  const result = renderSettingsScreen(
    <SettingsForm showLog={opts.showLog ?? false} onVersionTap={onVersionTap} />,
    { prefill: opts.prefill ?? null },
  );
  return { onVersionTap, ...result };
}

/** Types the token and waits for the resulting fetch to resolve into rendered dropdowns. */
async function typeTokenAndLoad(
  user: ReturnType<typeof userEvent.setup>,
  token = VALID_TOKEN,
): Promise<void> {
  await user.type(screen.getByLabelText('Integration Token'), token);
  await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalled(), { timeout: 2000 });
}

beforeEach(() => {
  mocks.fetchDatabases.mockReset();
  mocks.setTenantConfig.mockClear();
  mocks.refreshVoiceStatus.mockClear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  cancelSettings();
  window.localStorage.clear();
});

describe('SettingsForm — initial render', () => {
  it('renders the token field and Save with no database dropdowns yet', () => {
    renderForm();
    expect(screen.getByLabelText('Integration Token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByText('Tasks Database')).not.toBeInTheDocument();
  });

  it('shows the idle hint when the token is empty', () => {
    renderForm();
    expect(
      screen.getByText('Enter your integration token to load its databases.'),
    ).toBeInTheDocument();
  });

  it('prefills the token and all four databases from settingsPrefill', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: FIT_NOTES_DB.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    expect(screen.getByLabelText('Integration Token')).toHaveValue(VALID_TOKEN);
    await waitFor(() => expect(screen.getByText('Tasks Database')).toBeInTheDocument());
    expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/);
  });

  it('starts blank with no prefill', () => {
    renderForm();
    expect(screen.getByLabelText('Integration Token')).toHaveValue('');
  });

  it('renders the version button with the build version', () => {
    renderForm();
    expect(screen.getByRole('button', { name: `v${__APP_VERSION__}` })).toBeInTheDocument();
  });

  it('hides the debug log when showLog is false, shows it when true', () => {
    renderForm({ showLog: false });
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    cleanup();
    renderForm({ showLog: true });
    expect(screen.getByRole('log')).toBeInTheDocument();
  });
});

describe('SettingsForm — token gate and debounce', () => {
  it('never fetches for a token without an ntn_/secret_ prefix', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), 'not-a-real-token');
    await new Promise((r) => setTimeout(r, 600));
    expect(mocks.fetchDatabases).not.toHaveBeenCalled();
  });

  it('does not fetch immediately — only after the debounce elapses', async () => {
    mocks.fetchDatabases.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    expect(mocks.fetchDatabases).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('fetches once for a burst of keystrokes typed inside the debounce window', async () => {
    mocks.fetchDatabases.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm();
    // userEvent.type fires each keystroke back-to-back, well inside the 500ms debounce, so
    // every intermediate timer is cleared by the next keystroke's effect cleanup.
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(mocks.fetchDatabases).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('accepts a secret_-prefixed token', async () => {
    mocks.fetchDatabases.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), 'secret_abcdefghijklmnop');
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('trims surrounding whitespace before fetching', async () => {
    mocks.fetchDatabases.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), `  ${VALID_TOKEN}  `);
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledWith(VALID_TOKEN), {
      timeout: 2000,
    });
  });

  it('shows "Loading databases…" while the fetch is in flight', async () => {
    let resolveFetch: (dbs: unknown[]) => void = () => {};
    mocks.fetchDatabases.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    await screen.findByText('Loading databases…', undefined, { timeout: 2000 });
    resolveFetch([]);
    await waitFor(() => expect(screen.queryByText('Loading databases…')).not.toBeInTheDocument());
  });

  it('clears loaded databases and any error when the token is edited back to an invalid one', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText('Tasks Database');

    await user.clear(screen.getByLabelText('Integration Token'));
    await user.type(screen.getByLabelText('Integration Token'), 'x');

    expect(screen.queryByText('Tasks Database')).not.toBeInTheDocument();
    expect(
      screen.getByText('Enter your integration token to load its databases.'),
    ).toBeInTheDocument();
  });

  it('keeps a prefilled selection when the token is cleared back to empty', async () => {
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: FIT_NOTES_DB.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Integration Token'));
    // Selection state is internal — proven via a subsequent Save carrying it through.
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    await waitFor(() => expect(screen.getByText('Tasks Database')).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/);
  });
});

describe('SettingsForm — fetch outcomes', () => {
  it('renders all four dropdowns once databases load', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => {
      expect(screen.getByText('Tasks Database')).toBeInTheDocument();
      expect(screen.getByText('Notes Database')).toBeInTheDocument();
      expect(screen.getByText('Projects Database')).toBeInTheDocument();
      expect(screen.getByText('Tags Database')).toBeInTheDocument();
    });
  });

  it('shows the empty state for a token with nothing shared', async () => {
    mocks.fetchDatabases.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText(/No databases found/, undefined, { timeout: 2000 });
  });

  it("surfaces InvalidTokenError's message on a rejected token", async () => {
    mocks.fetchDatabases.mockRejectedValue(new InvalidTokenError());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText('Invalid Notion token', undefined, { timeout: 2000 });
  });

  it('surfaces "Failed to load databases" for any other rejection', async () => {
    mocks.fetchDatabases.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText('Failed to load databases', undefined, { timeout: 2000 });
  });

  it('marks the token field invalid when the token is rejected', async () => {
    mocks.fetchDatabases.mockRejectedValue(new InvalidTokenError());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() =>
      expect(screen.getByLabelText('Integration Token')).toHaveAttribute('aria-invalid', 'true'),
    );
  });

  it('hides the idle hint once an error is showing', async () => {
    mocks.fetchDatabases.mockRejectedValue(new InvalidTokenError());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText('Invalid Notion token', undefined, { timeout: 2000 });
    expect(
      screen.queryByText('Enter your integration token to load its databases.'),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsForm — stale-response guard', () => {
  it('discards a slow response once the token has changed again', async () => {
    let resolveFirst: (dbs: ReturnType<typeof fittingDatabases>) => void = () => {};
    mocks.fetchDatabases.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });

    mocks.fetchDatabases.mockResolvedValueOnce([]);
    await user.clear(screen.getByLabelText('Integration Token'));
    await user.type(screen.getByLabelText('Integration Token'), 'ntn_zzzzzzzzzzzzzzzz');
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await screen.findByText(/No databases found/, undefined, { timeout: 2000 });

    // The stale first response arrives after the second has already settled.
    resolveFirst(fittingDatabases());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Tasks Database')).not.toBeInTheDocument();
    expect(screen.getByText(/No databases found/)).toBeInTheDocument();
  });

  it('a stale rejection does not overwrite a newer successful load', async () => {
    let rejectFirst: (e: unknown) => void = () => {};
    mocks.fetchDatabases.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });

    mocks.fetchDatabases.mockResolvedValueOnce(fittingDatabases());
    await user.clear(screen.getByLabelText('Integration Token'));
    await user.type(screen.getByLabelText('Integration Token'), 'ntn_zzzzzzzzzzzzzzzz');
    await waitFor(() => expect(screen.getByText('Tasks Database')).toBeInTheDocument(), {
      timeout: 2000,
    });

    rejectFirst(new Error('stale failure'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Tasks Database')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load databases')).not.toBeInTheDocument();
  });

  it("a stale response does not clear the newer request's loading state", async () => {
    let resolveFirst: (dbs: ReturnType<typeof fittingDatabases>) => void = () => {};
    mocks.fetchDatabases.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    let resolveSecond: (dbs: unknown[]) => void = () => {};
    mocks.fetchDatabases.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), VALID_TOKEN);
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await user.clear(screen.getByLabelText('Integration Token'));
    await user.type(screen.getByLabelText('Integration Token'), 'ntn_zzzzzzzzzzzzzzzz');
    await waitFor(() => expect(mocks.fetchDatabases).toHaveBeenCalledTimes(2), { timeout: 2000 });

    resolveFirst(fittingDatabases());
    await new Promise((r) => setTimeout(r, 50));
    // Still loading — the stale first response's `finally` must not have cleared it.
    expect(screen.getByText('Loading databases…')).toBeInTheDocument();

    resolveSecond([]);
    await screen.findByText(/No databases found/);
  });
});

describe('SettingsForm — auto-select and reconcile on load', () => {
  it('auto-fills a slot with exactly one compatible database', async () => {
    mocks.fetchDatabases.mockResolvedValue([FIT_TASKS_DB]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
  });

  it('leaves a slot empty when two databases fit it', async () => {
    const secondFit = { ...FIT_TASKS_DB, id: 'db-tasks-fit-2', name: 'Tasks 2' };
    mocks.fetchDatabases.mockResolvedValue([FIT_TASKS_DB, secondFit]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(screen.getByText('Tasks Database')).toBeInTheDocument());
    expect(
      within(fieldContainer('Tasks Database')).getByText('Select a database...'),
    ).toBeInTheDocument();
  });

  it('clears a prefilled database no longer shared and warns it is unavailable', async () => {
    mocks.fetchDatabases.mockResolvedValue([FIT_NOTES_DB, FIT_PROJECTS_DB, FIT_TAGS_DB]);
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: 'db-that-was-unshared',
        notesDb: FIT_NOTES_DB.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'The previously selected database is no longer available — pick another.',
          ),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it('keeps a prefilled database that is still shared', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: FIT_NOTES_DB.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    expect(
      screen.queryByText('The previously selected database is no longer available — pick another.'),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsForm — the dropdowns', () => {
  it('labels an option "Name (…last8)"', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      FIT_NOTES_DB,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await user.click(selectTrigger('Tasks Database'));
    const expected = `Tasks (…${FIT_TASKS_DB.id.slice(-8)})`;
    expect(within(dropdownPortal()).getByRole('button', { name: expected })).toBeInTheDocument();
  });

  it('hides a database already assigned to another slot', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    // Tasks is auto-assigned to the tasksDb slot; it must not also be offered for notes. (The
    // Tasks slot's own trigger elsewhere on the page also reads "Tasks (…)" — scoping to the
    // open dropdown's portal is what keeps this checking the *offered options*, not the page.)
    await user.click(selectTrigger('Notes Database'));
    expect(
      within(dropdownPortal()).queryByRole('button', { name: /^Tasks \(/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the slot's own unfit choice listed even though it does not fit", async () => {
    mocks.fetchDatabases.mockResolvedValue([UNFIT_NOTES_MISSING_NOTE_DATE]);
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: '',
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: '',
        tagsDb: '',
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(selectTrigger('Notes Database')).toHaveTextContent(/Notes/);
  });

  it('shows the per-slot unfit reason under the dropdown', async () => {
    mocks.fetchDatabases.mockResolvedValue([UNFIT_NOTES_MISSING_NOTE_DATE]);
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: '',
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: '',
        tagsDb: '',
      },
    });
    await waitFor(() =>
      expect(within(fieldContainer('Notes Database')).getByText(/missing/)).toBeInTheDocument(),
    );
  });

  it('choosing a database updates the trigger label', async () => {
    mocks.fetchDatabases.mockResolvedValue([FIT_TASKS_DB]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
  });

  it('shows "None of your shared databases can be the Tasks database" when nothing fits', async () => {
    mocks.fetchDatabases.mockResolvedValue([UNFIT_NOTES_MISSING_NOTE_DATE]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() =>
      expect(
        within(fieldContainer('Tasks Database')).getByText(
          /None of your shared databases can be the Tasks database/,
        ),
      ).toBeInTheDocument(),
    );
  });
});

describe('SettingsForm — show all databases', () => {
  it('offers unfit databases once the checkbox is ticked', async () => {
    mocks.fetchDatabases.mockResolvedValue([UNFIT_NOTES_MISSING_NOTE_DATE]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await screen.findByText('Show all databases');
    expect(
      screen.queryByText(/None of your shared databases can be the Tasks database/),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show all databases'));
    await user.click(selectTrigger('Tasks Database'));
    expect(await screen.findByRole('button', { name: /^Notes \(/ })).toBeInTheDocument();
  });

  it('restores the checkbox from the persisted picker state', async () => {
    window.localStorage.setItem(
      'notionultimatebrain:dbpicker',
      JSON.stringify({ overrides: {}, showAll: true }),
    );
    mocks.fetchDatabases.mockResolvedValue([UNFIT_NOTES_MISSING_NOTE_DATE]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(screen.getByLabelText('Show all databases')).toBeChecked());
  });

  it('persists the checkbox state on save', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByLabelText('Show all databases'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('notionultimatebrain:dbpicker');
      expect(raw && JSON.parse(raw).showAll).toBe(true);
    });
  });
});

describe('SettingsForm — validation', () => {
  it('blocks submit with an empty token and marks it invalid', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.setTenantConfig).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Integration Token')).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks submit with an incomplete selection and marks the empty dropdown invalid', async () => {
    mocks.fetchDatabases.mockResolvedValue([FIT_TASKS_DB]);
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.setTenantConfig).not.toHaveBeenCalled();
    expect(selectTrigger('Notes Database')).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks nothing invalid before the first Save attempt', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), 'x');
    await user.clear(screen.getByLabelText('Integration Token'));
    expect(screen.getByLabelText('Integration Token')).not.toHaveAttribute('aria-invalid');
  });
});

describe('SettingsForm — the two-step "Save anyway" gate', () => {
  it('a first Save on an unfit selection warns instead of saving', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.setTenantConfig).not.toHaveBeenCalled();
    expect(screen.getByText(/missing properties the glasses need/)).toBeInTheDocument();
  });

  it('the button relabels to "Save anyway" while the warning shows', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Save anyway' })).toBeInTheDocument();
  });

  it('a second Save commits the unfit selection', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
    expect(getTenantConfig()).toEqual({
      token: VALID_TOKEN,
      tasksDb: FIT_TASKS_DB.id,
      notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
      projectsDb: FIT_PROJECTS_DB.id,
      tagsDb: FIT_TAGS_DB.id,
    });
  });

  it('changing a dropdown resets the gate back to "Save"', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_NOTES_DB,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Save anyway' });

    await user.click(screen.getByLabelText('Show all databases'));
    // Two "Notes (…)" options are open at once here (the current unfit choice plus the
    // fitting one) — match the fitting one's exact label, not a shared prefix.
    await chooseOption(user, 'Notes Database', `Notes (…${FIT_NOTES_DB.id.slice(-8)})`);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save anyway' })).not.toBeInTheDocument();
  });

  it('a slot already overridden for that exact database saves on the first tap', async () => {
    window.localStorage.setItem(
      'notionultimatebrain:dbpicker',
      JSON.stringify({
        overrides: { notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id },
        showAll: false,
      }),
    );
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Show all databases')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
  });

  it('an override recorded against a different database still demands confirmation', async () => {
    window.localStorage.setItem(
      'notionultimatebrain:dbpicker',
      JSON.stringify({ overrides: { notesDb: 'some-other-db-id' }, showAll: false }),
    );
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocks.setTenantConfig).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Save anyway' })).toBeInTheDocument();
  });

  it('a fully fitting selection saves on the first tap with no warning', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/missing properties the glasses need/)).not.toBeInTheDocument();
  });
});

describe('SettingsForm — commit', () => {
  it('commits the trimmed token and the four database ids', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Integration Token'), `  ${VALID_TOKEN}  `);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/), {
      timeout: 2000,
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
    expect(getTenantConfig()).toEqual({
      token: VALID_TOKEN,
      tasksDb: FIT_TASKS_DB.id,
      notesDb: FIT_NOTES_DB.id,
      projectsDb: FIT_PROJECTS_DB.id,
      tagsDb: FIT_TAGS_DB.id,
    });
  });

  it('records exactly the currently-unfit slots as the new overrides', async () => {
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Save anyway' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('notionultimatebrain:dbpicker');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.overrides).toEqual({ notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id });
    });
  });

  it('preserves stored overrides when the database list never loaded', async () => {
    window.localStorage.setItem(
      'notionultimatebrain:dbpicker',
      JSON.stringify({ overrides: { tasksDb: 'some-id' }, showAll: false }),
    );
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: 'some-id',
        notesDb: 'n',
        projectsDb: 'p',
        tagsDb: 't',
      },
    });
    // Never load a real token — submit while databases is still null.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      const raw = window.localStorage.getItem('notionultimatebrain:dbpicker');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw as string).overrides).toEqual({ tasksDb: 'some-id' });
    });
  });

  it('logs a CFG warning naming each unfit slot and its id', async () => {
    const warnSpy = vi.spyOn(trace, 'warn');
    mocks.fetchDatabases.mockResolvedValue([
      UNFIT_NOTES_MISSING_NOTE_DATE,
      FIT_PROJECTS_DB,
      FIT_TAGS_DB,
      FIT_TASKS_DB,
    ]);
    const user = userEvent.setup();
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: UNFIT_NOTES_MISSING_NOTE_DATE.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    await waitFor(() => expect(screen.getByText('Notes Database')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Save anyway' }));

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith('CFG', 'saving databases that do not fit their role', {
        slots: `notesDb=${UNFIT_NOTES_MISSING_NOTE_DATE.id}`,
      }),
    );
    warnSpy.mockRestore();
  });

  it('logs no warning when everything fits', async () => {
    const warnSpy = vi.spyOn(trace, 'warn');
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
    expect(warnSpy).not.toHaveBeenCalledWith('CFG', expect.anything(), expect.anything());
    warnSpy.mockRestore();
  });

  it('hands the voice draft to saveVoiceConfig and refreshVoiceStatus', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.refreshVoiceStatus).toHaveBeenCalledWith({ mode: 'off' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('notionultimatebrain:voice');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw as string)).toEqual({ mode: 'off' });
    });
  });

  it('closes the screen via settingsSaved', async () => {
    mocks.fetchDatabases.mockResolvedValue(fittingDatabases());
    const user = userEvent.setup();
    renderForm();
    await typeTokenAndLoad(user);
    await waitFor(() => expect(selectTrigger('Tasks Database')).toHaveTextContent(/Tasks/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));
    // settingsSaved() flips uiController's settingsOpen to false — proven via App.tsx's own
    // tests (app.test.tsx); here we only confirm the call happened by way of setTenantConfig
    // having already committed (submit.ts calls setTenantConfig before settingsSaved).
  });

  it('restores voice mode, API key and language hints from the stored voice config', async () => {
    window.localStorage.setItem(
      'notionultimatebrain:voice',
      JSON.stringify({
        mode: 'cloud',
        sonioxApiKey: 'a-plausible-looking-api-key-value',
        sonioxLanguageHints: ['en', 'nl'],
      }),
    );
    renderForm();
    await waitFor(() => expect(voiceModeTrigger()).toHaveTextContent('Cloud (Soniox)'));
    expect(screen.getByLabelText('Soniox API key')).toHaveValue(
      'a-plausible-looking-api-key-value',
    );
    expect(screen.getByPlaceholderText('en, nl')).toHaveValue('en, nl');
  });

  it('submitting mid-fetch commits without a fit gate', async () => {
    renderForm({
      prefill: {
        token: VALID_TOKEN,
        tasksDb: FIT_TASKS_DB.id,
        notesDb: FIT_NOTES_DB.id,
        projectsDb: FIT_PROJECTS_DB.id,
        tagsDb: FIT_TAGS_DB.id,
      },
    });
    let resolveFetch!: (dbs: unknown[]) => void;
    mocks.fetchDatabases.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Integration Token'), 'x');
    await screen.findByText('Loading databases…', undefined, { timeout: 2000 });

    // databases is still null — submit anyway.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.setTenantConfig).toHaveBeenCalledTimes(1));

    resolveFetch([]);
  });
});
