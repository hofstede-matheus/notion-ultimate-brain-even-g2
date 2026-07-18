/**
 * DOM wiring + persistence for the Notion tenant-config settings form.
 * Mirrors the connect-button pattern in shell.ts and the bridge-storage
 * pattern in cache.ts, with a browser localStorage fallback for dev without
 * the Even Hub bridge.
 */

import { getBridge } from '../state'
import type { TenantConfig } from '../tenant-config'

const CONFIG_KEY = 'notionultimatebrain:config'

const formEl = document.getElementById('settings-form') as HTMLFormElement | null
const tokenInput = document.getElementById('settings-token') as HTMLInputElement | null
const tasksDbInput = document.getElementById('settings-tasks-db') as HTMLInputElement | null
const notesDbInput = document.getElementById('settings-notes-db') as HTMLInputElement | null
const projectsDbInput = document.getElementById('settings-projects-db') as HTMLInputElement | null
const tagsDbInput = document.getElementById('settings-tags-db') as HTMLInputElement | null
const excludeProjectIdInput = document.getElementById('settings-exclude-project-id') as HTMLInputElement | null
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement | null

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadStoredConfig(): Promise<TenantConfig | null> {
  const b = getBridge()
  try {
    const raw = b ? await b.getLocalStorage(CONFIG_KEY) : window.localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TenantConfig
  } catch {
    return null
  }
}

/** Failures are swallowed — persistence is best-effort, same as cache.ts. */
export async function saveStoredConfig(cfg: TenantConfig): Promise<void> {
  const raw = JSON.stringify(cfg)
  const b = getBridge()
  try {
    if (b) await b.setLocalStorage(CONFIG_KEY, raw)
    else window.localStorage.setItem(CONFIG_KEY, raw)
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function fillForm(cfg: TenantConfig | null): void {
  if (tokenInput) tokenInput.value = cfg?.token ?? ''
  if (tasksDbInput) tasksDbInput.value = cfg?.tasksDb ?? ''
  if (notesDbInput) notesDbInput.value = cfg?.notesDb ?? ''
  if (projectsDbInput) projectsDbInput.value = cfg?.projectsDb ?? ''
  if (tagsDbInput) tagsDbInput.value = cfg?.tagsDb ?? ''
  if (excludeProjectIdInput) excludeProjectIdInput.value = cfg?.excludeProjectId ?? ''
}

function readForm(): TenantConfig | null {
  const token = tokenInput?.value.trim() ?? ''
  const tasksDb = tasksDbInput?.value.trim() ?? ''
  const notesDb = notesDbInput?.value.trim() ?? ''
  const projectsDb = projectsDbInput?.value.trim() ?? ''
  const tagsDb = tagsDbInput?.value.trim() ?? ''
  const excludeProjectId = excludeProjectIdInput?.value.trim() || undefined
  if (!token || !tasksDb || !notesDb || !projectsDb || !tagsDb) return null
  return { token, tasksDb, notesDb, projectsDb, tagsDb, excludeProjectId }
}

function showSettings(): void {
  if (formEl) formEl.style.display = 'grid'
}

function hideSettings(): void {
  if (formEl) formEl.style.display = 'none'
}

/**
 * Reveal the settings form pre-filled with `prefill`, and resolve once the
 * user submits a valid config (token + all 4 DB fields non-empty).
 */
export function promptForConfig(prefill?: TenantConfig | null): Promise<TenantConfig> {
  fillForm(prefill ?? null)
  showSettings()

  return new Promise((resolve) => {
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault()
      const cfg = readForm()
      if (!cfg) return // native `required` attrs should prevent this; guard anyway
      formEl?.removeEventListener('submit', onSubmit)
      hideSettings()
      resolve(cfg)
    }
    formEl?.addEventListener('submit', onSubmit)
  })
}

export function onSettingsClick(handler: () => void): void {
  settingsBtn?.addEventListener('click', handler)
}
