export interface Config {
  port: number
  notionApiKey: string
  notionTasksDb: string
  notionNotesDb: string
  notionProjectsDb: string
  notionTagsDb: string
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT) || 3210,
    notionApiKey: process.env.NOTION_API_KEY ?? '',
    notionTasksDb: process.env.NOTION_TASKS_DB ?? '',
    notionNotesDb: process.env.NOTION_NOTES_DB ?? '',
    notionProjectsDb: process.env.NOTION_PROJECTS_DB ?? '',
    notionTagsDb: process.env.NOTION_TAGS_DB ?? '',
  }
}

export function assertConfig(config: Config): void {
  const required: Record<string, string> = {
    NOTION_API_KEY: config.notionApiKey,
    NOTION_TASKS_DB: config.notionTasksDb,
    NOTION_NOTES_DB: config.notionNotesDb,
    NOTION_PROJECTS_DB: config.notionProjectsDb,
    NOTION_TAGS_DB: config.notionTagsDb,
  }
  for (const [key, value] of Object.entries(required)) {
    if (!value) throw new Error(`Missing ${key} in environment`)
  }
}

export const config = loadConfig()
