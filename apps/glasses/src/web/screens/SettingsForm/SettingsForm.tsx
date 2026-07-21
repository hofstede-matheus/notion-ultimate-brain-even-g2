import type { TenantConfig } from '@notion-ub/contracts';
import { Button } from 'even-toolkit/web/button';
import { Divider } from 'even-toolkit/web/divider';
import { Input } from 'even-toolkit/web/input';
import { Page } from 'even-toolkit/web/page';
import { type FormEvent, useEffect, useState } from 'react';
import { useUiState } from '../../hooks/useUiState';
import { resolveSettings } from '../../providers/uiController';
import { LogConsole } from './components/LogConsole';

type FieldKey = 'token' | 'tasksDb' | 'notesDb' | 'projectsDb' | 'tagsDb' | 'excludeProjectId';

interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'token', label: 'Integration Token', required: true },
  { key: 'tasksDb', label: 'Tasks Database ID', required: true },
  { key: 'notesDb', label: 'Notes Database ID', required: true },
  { key: 'projectsDb', label: 'Projects Database ID', required: true },
  { key: 'tagsDb', label: 'Tags Database ID', required: true },
  { key: 'excludeProjectId', label: 'Excluded Project ID (optional)', required: false },
];

function fieldValues(prefill: TenantConfig | null): Record<FieldKey, string> {
  return {
    token: prefill?.token ?? '',
    tasksDb: prefill?.tasksDb ?? '',
    notesDb: prefill?.notesDb ?? '',
    projectsDb: prefill?.projectsDb ?? '',
    tagsDb: prefill?.tagsDb ?? '',
    excludeProjectId: prefill?.excludeProjectId ?? '',
  };
}

/**
 * The Notion tenant-config form — opened via ../../providers/uiController's
 * settingsOpen flag (see promptForConfig) and resolved on valid submit,
 * which is the same contract ../../../boot.ts's `reconfigure()` already
 * relies on.
 */
export function SettingsForm() {
  const ui = useUiState();
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    fieldValues(ui.settingsPrefill),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValues(fieldValues(ui.settingsPrefill));
    setTouched(false);
  }, [ui.settingsPrefill]);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setTouched(true);

    const token = values.token.trim();
    const tasksDb = values.tasksDb.trim();
    const notesDb = values.notesDb.trim();
    const projectsDb = values.projectsDb.trim();
    const tagsDb = values.tagsDb.trim();
    if (!token || !tasksDb || !notesDb || !projectsDb || !tagsDb) return;

    const excludeProjectId = values.excludeProjectId.trim() || undefined;
    resolveSettings({ token, tasksDb, notesDb, projectsDb, tagsDb, excludeProjectId });
  }

  return (
    <Page>
      <h2 className="text-[17px] tracking-[-0.17px] mb-3">Notion Settings</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={`settings-${field.key}`}
              className="text-[13px] tracking-[-0.13px] text-text-dim mb-1 block"
            >
              {field.label}
            </label>
            <Input
              id={`settings-${field.key}`}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              error={touched && field.required && !values[field.key].trim()}
            />
          </div>
        ))}
        <Divider variant="spaced" />
        <Button type="submit" variant="highlight">
          Save
        </Button>
      </form>
      <LogConsole />
    </Page>
  );
}
