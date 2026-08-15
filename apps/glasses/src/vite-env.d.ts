/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** Overrides where the offline voice model is downloaded from (see voice-model.ts). */
  readonly VITE_VOICE_MODEL_URL?: string;
  /** Dev-only auto-fill for the Notion settings form (see tenant-config.ts). */
  readonly VITE_NOTION_TOKEN?: string;
  readonly VITE_NOTION_TASKS_DB?: string;
  readonly VITE_NOTION_NOTES_DB?: string;
  readonly VITE_NOTION_PROJECTS_DB?: string;
  readonly VITE_NOTION_TAGS_DB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Baked in by vite.config.ts's `define` from package.json's version. */
declare const __APP_VERSION__: string;
