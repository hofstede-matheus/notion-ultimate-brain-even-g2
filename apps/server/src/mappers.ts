import type { Task, Note, Project, Tag } from '@notion-ub/contracts'

export function pageTitle(page: any): string {
  const props = page.properties
  const titleProp = props['Name'] || props['Task'] || props['Title']
  return titleProp?.title?.[0]?.plain_text ?? titleProp?.rich_text?.[0]?.plain_text ?? '(untitled)'
}

export function pageToTask(page: any): Task {
  const dueDate = page.properties['Due']?.date?.start ?? undefined
  const status = page.properties['Status']?.status?.name ?? undefined
  return { id: page.id, name: pageTitle(page), dueDate, status }
}

export function pageToNote(page: any): Note {
  const icon = page.icon?.emoji ?? page.icon?.external?.url ?? page.icon?.file?.url ?? undefined
  const lastEdited = page.last_edited_time ?? undefined
  return { id: page.id, name: pageTitle(page), icon, lastEdited }
}

export function pageToProject(page: any): Project {
  const status = page.properties['Status']?.status?.name ?? undefined
  return { id: page.id, name: pageTitle(page), status }
}

export function pageToTag(page: any): Tag {
  return { id: page.id, name: pageTitle(page) }
}
