import type { NotionDatabaseSummary, TenantConfig } from '@notion-ub/contracts';
import { Button } from 'even-toolkit/web/button';
import { Divider } from 'even-toolkit/web/divider';
import { Input } from 'even-toolkit/web/input';
import { Page } from 'even-toolkit/web/page';
import { Select } from 'even-toolkit/web/select';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useUiState } from '../../hooks/useUiState';
import { resolveSettings } from '../../providers/uiController';
import { fetchDatabases, InvalidTokenError } from '../../services/databases';
import { LogConsole } from './components/LogConsole';
import {
  autoSelect,
  availableOptionsFor,
  compatibleOptionsFor,
  DB_SLOTS,
  type DbSelection,
  EMPTY_SELECTION,
  isSelectionComplete,
  reconcileSelection,
  unfitReason,
  unfitSlots,
} from './dbSelection';

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

/**
 * The Notion tenant-config form — opened via ../../providers/uiController's
 * settingsOpen flag (see promptForConfig) and resolved on valid submit,
 * which is the same contract ../../../boot.ts's `reconfigure()` already
 * relies on.
 *
 * The four database fields are dropdowns rather than free-text ids: once a
 * token looks complete, its databases are fetched (see ../../services/databases.ts)
 * and offered as options, with a database already picked for one slot hidden
 * from the other three so the same database can never be assigned twice.
 */
export function SettingsForm() {
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
  // hiding is the default but never the only option.
  const [showAll, setShowAll] = useState(false);
  // An unfit selection warns instead of blocking outright — Save once to see the warning,
  // again to confirm it. Reset whenever the selection changes so a stale confirmation can't
  // silently wave through a later, different mistake.
  const [confirmUnfit, setConfirmUnfit] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    setToken(ui.settingsPrefill?.token ?? '');
    setSelection(selectionFromPrefill(ui.settingsPrefill));
    setDatabases(null);
    setTokenError(null);
    setTouched(false);
    setShowAll(false);
    setConfirmUnfit(false);
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
    const unfit = databases ? unfitSlots(selection, databases) : [];
    if (unfit.length > 0 && !confirmUnfit) {
      setConfirmUnfit(true);
      return;
    }

    resolveSettings({ token: trimmedToken, ...selection });
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
            const allOptions = availableOptionsFor(slot.key, databases, selection);
            const fitOptions = compatibleOptionsFor(slot.key, databases, selection);
            const options = showAll ? allOptions : fitOptions;
            const hiddenCount = allOptions.length - fitOptions.length;
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
                {!showAll && hiddenCount > 0 && (
                  <p className="text-[12px] text-text-dim mt-1">
                    {hiddenCount} of {allOptions.length} database
                    {allOptions.length === 1 ? '' : 's'} hidden — they can't be a{' '}
                    {slot.label.replace(' Database', '')} database.
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
            One or more selected databases are missing properties the glasses need — lists from them
            may come back empty. Tap Save again to use them anyway.
          </p>
        )}

        <Divider variant="spaced" />
        <Button type="submit" variant="highlight">
          {confirmUnfit ? 'Save anyway' : 'Save'}
        </Button>
      </form>
      <LogConsole />
    </Page>
  );
}
