import type { Note, Project, Tag, Task } from '@notion-ub/contracts';

interface NotionText {
  plain_text?: string;
}

/** The slice of a Notion page property these mappers read. */
export interface NotionProperty {
  title?: NotionText[];
  rich_text?: NotionText[];
  date?: { start?: string | null } | null;
  status?: { name?: string } | null;
  relation?: Array<{ id: string }>;
}

/**
 * The subset of a Notion page object these mappers read. Kept structural (and
 * all-optional beyond `id`) so the Notion SDK's page/partial-page response
 * union is assignable to it without per-call casts.
 */
export interface NotionPage {
  id: string;
  icon?: { emoji?: string; external?: { url?: string }; file?: { url?: string } } | null;
  last_edited_time?: string;
  properties?: Record<string, NotionProperty | undefined>;
}

export function pageTitle(page: Pick<NotionPage, 'properties'>): string {
  const props = page.properties;
  const titleProp = props?.Name ?? props?.Task ?? props?.Title;
  return titleProp?.title?.[0]?.plain_text ?? titleProp?.rich_text?.[0]?.plain_text ?? '(untitled)';
}

export function pageToTask(page: NotionPage): Task {
  const dueDate = page.properties?.Due?.date?.start ?? undefined;
  const status = page.properties?.Status?.status?.name ?? undefined;
  return { id: page.id, name: pageTitle(page), dueDate, status };
}

export function pageToNote(page: NotionPage): Note {
  const icon = page.icon?.emoji ?? page.icon?.external?.url ?? page.icon?.file?.url ?? undefined;
  const lastEdited = page.last_edited_time ?? undefined;
  return { id: page.id, name: pageTitle(page), icon, lastEdited };
}

export function pageToProject(page: NotionPage): Project {
  const status = page.properties?.Status?.status?.name ?? undefined;
  return { id: page.id, name: pageTitle(page), status };
}

export function pageToTag(page: NotionPage): Tag {
  return { id: page.id, name: pageTitle(page) };
}
