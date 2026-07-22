/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
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
