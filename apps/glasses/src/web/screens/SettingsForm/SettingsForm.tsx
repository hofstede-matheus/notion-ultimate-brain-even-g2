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
  availableOptionsFor,
  DB_SLOTS,
  type DbSelection,
  EMPTY_SELECTION,
  isSelectionComplete,
  reconcileSelection,
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
  const requestId = useRef(0);

  useEffect(() => {
    setToken(ui.settingsPrefill?.token ?? '');
    setSelection(selectionFromPrefill(ui.settingsPrefill));
    setDatabases(null);
    setTokenError(null);
    setTouched(false);
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
          setSelection((sel) => reconcileSelection(sel, dbs));
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
            In the integration's Content access tab, grant access to only the Ultimate Brain page —
            not the whole workspace. This keeps the token scoped and the database lists below short.
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
          DB_SLOTS.map((slot) => (
            <div key={slot.key}>
              <label
                htmlFor={`settings-${slot.key}`}
                className="text-[13px] tracking-[-0.13px] text-text-dim mb-1 block"
              >
                {slot.label}
              </label>
              <Select
                value={selection[slot.key]}
                onValueChange={(value) => setSelection((sel) => ({ ...sel, [slot.key]: value }))}
                options={availableOptionsFor(slot.key, databases, selection).map((db) => ({
                  value: db.id,
                  label: `${db.name} (…${db.id.slice(-8)})`,
                }))}
                placeholder="Select a database..."
                error={touched && !selection[slot.key]}
              />
              {!selection[slot.key] && prefillSelection[slot.key] && (
                <p className="text-[12px] text-negative mt-1">
                  The previously selected database is no longer available — pick another.
                </p>
              )}
            </div>
          ))}

        <p className="text-[12px] text-text-dim">
          Not sure which to pick? In Notion, open the database inside Databases & Components, copy
          its link, and compare the part between the last <code>/</code> and <code>?v=</code> with
          the id in the dropdown — they should match.
        </p>

        <Divider variant="spaced" />
        <Button type="submit" variant="highlight">
          Save
        </Button>
      </form>
      <LogConsole />
    </Page>
  );
}
