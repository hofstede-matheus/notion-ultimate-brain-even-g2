import type { NotionDatabaseSummary, TenantConfig } from '@notion-ub/contracts';
import { Button } from 'even-toolkit/web/button';
import { Divider } from 'even-toolkit/web/divider';
import { Input } from 'even-toolkit/web/input';
import { Page } from 'even-toolkit/web/page';
import { Select } from 'even-toolkit/web/select';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { trace } from '../../../logging/trace';
import { formatLanguageHints } from '../../../stt/soniox-languages';
import { setTenantConfig } from '../../../tenant-config';
import { loadVoiceConfig, saveVoiceConfig, type VoiceMode } from '../../../voice-config';
import { refreshVoiceStatus } from '../../../voice-runtime';
import { useUiState } from '../../hooks/useUiState';
import { settingsSaved } from '../../providers/uiController';
import {
  type DbPickerState,
  loadDbPickerState,
  saveDbPickerState,
  saveStoredConfig,
} from '../../services/config';
import { fetchDatabases, InvalidTokenError } from '../../services/databases';
import { LogConsole } from './components/LogConsole';
import { VoiceSection } from './components/VoiceSection';
import {
  autoSelect,
  DB_SLOTS,
  type DbSelection,
  EMPTY_SELECTION,
  isSelectionComplete,
  optionsForSlot,
  reconcileSelection,
  unfitReason,
  unfitSlots,
} from './dbSelection';
import { commitSettings } from './submit';
import { voiceConfigFromDraft } from './voiceSection';

/** How long to wait after the token stops changing before fetching its databases. */
const TOKEN_DEBOUNCE_MS = 500;

/** Notion integration tokens start with one of these — avoids firing a fetch
 * on every keystroke before the token is plausibly complete. */
const TOKEN_PREFIX_PATTERN = /^(ntn_|secret_)/;

function selectionFromPrefill(prefill: TenantConfig | null): DbSelection {
  if (!prefill) return EMPTY_SELECTION;
  return {
    tasksDb: prefill.tasksDb,
    notesDb: prefill.notesDb,
    projectsDb: prefill.projectsDb,
    tagsDb: prefill.tagsDb,
  };
}

export interface SettingsFormProps {
  /** Session-only; lifted to App so Back does not reset the unlock. */
  showLog: boolean;
  onVersionTap: () => void;
}

/**
 * The Notion tenant-config form — opened via ../../providers/uiController's
 * settingsOpen flag (see promptForConfig). On valid submit it commits the config itself
 * (./submit.ts's commitSettings: setTenantConfig, then settingsSaved) rather than handing it
 * back to a caller to persist, which is the same contract ../../../boot.ts's `reconfigure()`
 * already relies on.
 *
 * The four database fields are dropdowns rather than free-text ids: once a
 * token looks complete, its databases are fetched (see ../../services/databases.ts)
 * and offered as options, with a database already picked for one slot hidden
 * from the other three so the same database can never be assigned twice.
 */
export function SettingsForm({ showLog, onVersionTap }: SettingsFormProps) {
  const ui = useUiState();
  const [token, setToken] = useState(() => ui.settingsPrefill?.token ?? '');
  const [selection, setSelection] = useState<DbSelection>(() =>
    selectionFromPrefill(ui.settingsPrefill),
  );
  const [databases, setDatabases] = useState<NotionDatabaseSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // Escape hatch for a customised Ultimate Brain whose property was renamed — the
  // requirement table in @notion-ub/contracts is a guess about *other people's* schemas, so
  // hiding is the default but never the only option. Restored from the last session rather
  // than reset, since turning it on is a deliberate decision about one's own workspace.
  const [showAll, setShowAll] = useState(false);
  // Slots whose fit warning was already overridden with "Save anyway", by database id — so the
  // same confirmed choice doesn't have to be re-confirmed on every later save.
  const [overrides, setOverrides] = useState<DbPickerState['overrides']>({});
  // An unfit selection warns instead of blocking outright — Save once to see the warning,
  // again to confirm it. Reset whenever the selection changes so a stale confirmation can't
  // silently wave through a later, different mistake.
  const [confirmUnfit, setConfirmUnfit] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off');
  const [apiKey, setApiKey] = useState('');
  const [languageHints, setLanguageHints] = useState('');
  const [languageHintsStrict, setLanguageHintsStrict] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    setToken(ui.settingsPrefill?.token ?? '');
    setSelection(selectionFromPrefill(ui.settingsPrefill));
    setDatabases(null);
    setTokenError(null);
    setTouched(false);
    setConfirmUnfit(false);
    void loadDbPickerState().then((picker) => {
      setShowAll(picker.showAll);
      setOverrides(picker.overrides);
    });
    void loadVoiceConfig().then((cfg) => {
      setVoiceMode(cfg.mode);
      setApiKey(cfg.sonioxApiKey ?? '');
      setLanguageHints(formatLanguageHints(cfg.sonioxLanguageHints ?? []));
      setLanguageHintsStrict(cfg.sonioxLanguageHintsStrict === true);
    });
  }, [ui.settingsPrefill]);

  // Auto-load: once the token looks complete, debounce then fetch its
  // databases. A monotonic request id discards a response that arrives after
  // a newer request has already started (fast edits, slow network).
  useEffect(() => {
    const trimmed = token.trim();
    if (!TOKEN_PREFIX_PATTERN.test(trimmed)) {
      requestId.current++;
      setDatabases(null);
      setTokenError(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setTokenError(null);
    const timer = setTimeout(() => {
      setLoading(true);
      fetchDatabases(trimmed)
        .then((dbs) => {
          if (requestId.current !== id) return;
          setDatabases(dbs);
          setSelection((sel) => autoSelect(dbs, reconcileSelection(sel, dbs)));
        })
        .catch((err) => {
          if (requestId.current !== id) return;
          setDatabases(null);
          setTokenError(
            err instanceof InvalidTokenError ? err.message : 'Failed to load databases',
          );
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, TOKEN_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [token]);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setTouched(true);

    const trimmedToken = token.trim();
    if (!trimmedToken || !isSelectionComplete(selection)) return;

    // An unfit selection warns rather than blocks — the requirement table is a guess about
    // someone else's schema, and refusing to save on a possibly-wrong guess would make the
    // form unusable for a legitimately customised Ultimate Brain. First Save surfaces the
    // warning (via the per-slot messages already on screen); a second Save goes through.
    // A slot already confirmed for this exact database skips the gate — re-demanding a decision
    // the user has already made is part of what made an overridden choice feel unsaved.
    const unfit = databases ? unfitSlots(selection, databases) : [];
    const unconfirmed = unfit.filter((slot) => overrides[slot] !== selection[slot]);
    if (unconfirmed.length > 0 && !confirmUnfit) {
      setConfirmUnfit(true);
      return;
    }

    // `databases === null` means the list never loaded (bad token, network) — there is nothing
    // to re-evaluate fit against, so the stored overrides stay as they were rather than being
    // wiped by an unfitSlots() that had nothing to look at.
    const nextOverrides = databases
      ? Object.fromEntries(unfit.map((slot) => [slot, selection[slot]]))
      : overrides;
    if (unfit.length > 0) {
      trace.warn('CFG', 'saving databases that do not fit their role', {
        slots: unfit.map((slot) => `${slot}=${selection[slot]}`).join(', '),
      });
    }

    commitSettings(
      {
        token: trimmedToken,
        selection,
        picker: { overrides: nextOverrides, showAll },
        voiceCfg: voiceConfigFromDraft(voiceMode, apiKey, languageHints, languageHintsStrict),
      },
      {
        setTenantConfig,
        settingsSaved,
        saveStoredConfig,
        saveDbPickerState,
        saveVoiceConfig,
        refreshVoiceStatus,
      },
    );
  }

  const ready = databases !== null;
  const prefillSelection = selectionFromPrefill(ui.settingsPrefill);

  return (
    <Page>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="settings-token"
            className="text-[13px] tracking-[-0.13px] text-text-dim mb-1 block"
          >
            Integration Token
          </label>
          <Input
            id="settings-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            error={tokenError ?? (touched && !token.trim())}
          />
          <p className="text-[12px] text-text-dim mt-1">
            Enable Read, Update, and Insert content in Capabilities, then grant Content access only
            to the Ultimate Brain page — not the whole workspace — to keep the token scoped.
          </p>
        </div>

        {loading && <p className="text-[13px] text-text-dim">Loading databases…</p>}

        {!loading && !ready && !tokenError && (
          <p className="text-[13px] text-text-dim">
            Enter your integration token to load its databases.
          </p>
        )}

        {!loading && ready && databases.length === 0 && (
          <p className="text-[13px] text-text-dim">
            No databases found. Share your Tasks, Notes, Projects and Tags databases with this
            integration in Notion, then try again.
          </p>
        )}

        {ready &&
          databases.length > 0 &&
          DB_SLOTS.map((slot) => {
            const options = optionsForSlot(slot.key, databases, selection, showAll);
            const currentDb = databases.find((db) => db.id === selection[slot.key]);
            const currentUnfitReason = currentDb ? unfitReason(currentDb, slot.key) : null;

            return (
              <div key={slot.key}>
                <label
                  htmlFor={`settings-${slot.key}`}
                  className="text-[13px] tracking-[-0.13px] text-text-dim mb-1 block"
                >
                  {slot.label}
                </label>
                <Select
                  value={selection[slot.key]}
                  onValueChange={(value) => {
                    setSelection((sel) => ({ ...sel, [slot.key]: value }));
                    setConfirmUnfit(false);
                  }}
                  options={options.map((db) => ({
                    value: db.id,
                    label: `${db.name} (…${db.id.slice(-8)})`,
                  }))}
                  placeholder="Select a database..."
                  error={currentUnfitReason ?? (touched && !selection[slot.key])}
                />
                {!selection[slot.key] && prefillSelection[slot.key] && (
                  <p className="text-[12px] text-negative mt-1">
                    The previously selected database is no longer available — pick another.
                  </p>
                )}
                {!selection[slot.key] && options.length === 0 && !showAll && (
                  <p className="text-[12px] text-negative mt-1">
                    None of your shared databases can be the {slot.label.replace(' Database', '')}{' '}
                    database. Share your Ultimate Brain {slot.label.replace(' Database', '')}{' '}
                    database with the integration.
                  </p>
                )}
              </div>
            );
          })}

        {ready && databases.length > 0 && (
          <label className="flex items-center gap-2 text-[13px] text-text-dim">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all databases
          </label>
        )}

        <p className="text-[12px] text-text-dim">
          Not sure which to pick? In Notion, open the database inside Databases & Components, copy
          its link, and compare the part between the last <code>/</code> and <code>?v=</code> with
          the id in the dropdown — they should match.
        </p>

        {confirmUnfit && (
          <p className="text-[12px] text-negative">
            One or more selected databases are missing properties the glasses need — the lists that
            use them won't load. Tap Save again to use them anyway.
          </p>
        )}

        <VoiceSection
          mode={voiceMode}
          apiKey={apiKey}
          languageHints={languageHints}
          languageHintsStrict={languageHintsStrict}
          onModeChange={setVoiceMode}
          onApiKeyChange={setApiKey}
          onLanguageHintsChange={setLanguageHints}
          onLanguageHintsStrictChange={setLanguageHintsStrict}
        />

        <Divider variant="spaced" />
        <Button type="submit" variant="highlight">
          {confirmUnfit ? 'Save anyway' : 'Save'}
        </Button>
      </form>
      {showLog ? <LogConsole /> : null}
      <button
        type="button"
        onClick={onVersionTap}
        className="text-[12px] text-text-dim text-center w-full mb-4"
      >
        v{__APP_VERSION__}
      </button>
    </Page>
  );
}
