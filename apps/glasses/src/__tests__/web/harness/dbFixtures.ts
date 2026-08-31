/**
 * Database fixtures for the Settings-screen component tests — real
 * ROLE_REQUIREMENTS-satisfying property maps (packages/contracts/src/db-roles-requirements.ts),
 * not invented parallel schemas that could drift from what `evaluateRoles` actually checks.
 * Mirrors the fixture style already established in dbSelection.test.ts.
 */
import type { NotionDatabaseSummary } from '@notion-ub/contracts';

/** Fits every requirement of the `tasks` role. */
export const FIT_TASKS_DB: NotionDatabaseSummary = {
  id: 'db-tasks-fit',
  name: 'Tasks',
  properties: {
    Name: 'title',
    Status: 'status',
    Due: 'date',
    Snooze: 'date',
    Project: 'relation',
    Created: 'created_time',
    'Sub-Task Sorter': 'formula',
  },
};

/** Fits every requirement of the `notes` role. */
export const FIT_NOTES_DB: NotionDatabaseSummary = {
  id: 'db-notes-fit',
  name: 'Notes',
  properties: {
    Name: 'title',
    Archived: 'checkbox',
    Favorite: 'checkbox',
    Type: 'select',
    URL: 'url',
    Tag: 'relation',
    Project: 'relation',
    Content: 'relation',
    Updated: 'last_edited_time',
    'Note Date': 'date',
  },
};

/** Fits every requirement of the `projects` role. */
export const FIT_PROJECTS_DB: NotionDatabaseSummary = {
  id: 'db-projects-fit',
  name: 'Projects',
  properties: {
    Name: 'title',
    Archived: 'checkbox',
    Status: 'status',
    Meta: 'formula',
    'Latest Activity': 'formula',
    'Target Deadline': 'date',
  },
};

/** Fits every requirement of the `tags` role. */
export const FIT_TAGS_DB: NotionDatabaseSummary = {
  id: 'db-tags-fit',
  name: 'Tags',
  properties: {
    Name: 'title',
    Archived: 'checkbox',
    Favorite: 'checkbox',
    Type: 'status', // tags' Type is a status property, not select — see CLAUDE.md's gotcha
    'Latest Activity': 'formula',
  },
};

/** A complete, mutually-fitting set for the four slots — the common "everything fits" case. */
export function fittingDatabases(): NotionDatabaseSummary[] {
  return [FIT_TASKS_DB, FIT_NOTES_DB, FIT_PROJECTS_DB, FIT_TAGS_DB];
}

/**
 * A Notes database missing only `Note Date` — issue #40's own example. Only the two views that
 * sort on it (Meetings, Journal) fail to load; the other eight still work. Fits every other
 * role's requirements are irrelevant here since only `notes`' own fit is exercised.
 */
export const UNFIT_NOTES_MISSING_NOTE_DATE: NotionDatabaseSummary = {
  id: 'db-notes-missing-note-date',
  name: 'Notes',
  properties: {
    Name: 'title',
    Archived: 'checkbox',
    Favorite: 'checkbox',
    Type: 'select',
    URL: 'url',
    Tag: 'relation',
    Project: 'relation',
    Content: 'relation',
    Updated: 'last_edited_time',
  },
};

/** No `properties` at all — an older server response. Fails open: fits every role. */
export const UNKNOWN_SCHEMA_DB: NotionDatabaseSummary = {
  id: 'db-unknown-schema',
  name: 'Mystery',
};
