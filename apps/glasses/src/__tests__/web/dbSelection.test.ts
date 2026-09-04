import { describe, expect, it } from 'vitest';
import {
  autoSelect,
  availableOptionsFor,
  compatibleOptionsFor,
  EMPTY_SELECTION,
  fitsSlot,
  isSelectionComplete,
  optionsForSlot,
  reconcileSelection,
  unfitReason,
  unfitSlots,
} from '../../web/screens/SettingsForm/dbSelection';

const databases = [
  { id: 'd1', name: 'Tasks' },
  { id: 'd2', name: 'Notes' },
  { id: 'd3', name: 'Projects' },
];

// A real Ultimate Brain Projects schema (fits the projects role) alongside the stock-template
// decoy that caused the incident this feature exists to prevent (doesn't fit any role).
const REAL_PROJECTS_DB = {
  id: 'real-projects',
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
const DECOY_PROJECTS_DB = {
  id: 'decoy-projects',
  name: 'Projects',
  properties: {
    'Project name': 'title',
    Status: 'status',
    Priority: 'select',
  },
};
const UNKNOWN_SCHEMA_DB = { id: 'unknown', name: 'Something' }; // no `properties` — older server

// A real Ultimate Brain Notes schema missing only Note Date — issue #40's own example: only the
// two views that sort on it (Meetings, Journal) actually fail; the other eight still work.
const NOTES_MISSING_NOTE_DATE = {
  id: 'notes-missing-note-date',
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

describe('availableOptionsFor', () => {
  it('offers every database when nothing else is chosen', () => {
    expect(availableOptionsFor('tasksDb', databases, EMPTY_SELECTION)).toEqual(databases);
  });

  it('hides a database already chosen for another slot', () => {
    const selection = { ...EMPTY_SELECTION, notesDb: 'd1' };
    const options = availableOptionsFor('tasksDb', databases, selection);
    expect(options.map((d) => d.id)).toEqual(['d2', 'd3']);
  });

  it("keeps the slot's own current choice visible", () => {
    const selection = { ...EMPTY_SELECTION, tasksDb: 'd1' };
    const options = availableOptionsFor('tasksDb', databases, selection);
    expect(options.map((d) => d.id)).toContain('d1');
  });

  it('hides a database from every other slot once picked', () => {
    const selection = { ...EMPTY_SELECTION, tasksDb: 'd1' };
    expect(availableOptionsFor('notesDb', databases, selection).map((d) => d.id)).toEqual([
      'd2',
      'd3',
    ]);
    expect(availableOptionsFor('projectsDb', databases, selection).map((d) => d.id)).toEqual([
      'd2',
      'd3',
    ]);
  });
});

describe('isSelectionComplete', () => {
  it('is false until all four slots are chosen', () => {
    expect(isSelectionComplete(EMPTY_SELECTION)).toBe(false);
    expect(
      isSelectionComplete({ tasksDb: 'd1', notesDb: 'd2', projectsDb: 'd3', tagsDb: '' }),
    ).toBe(false);
  });

  it('is true once every slot has a non-empty id', () => {
    expect(
      isSelectionComplete({ tasksDb: 'd1', notesDb: 'd2', projectsDb: 'd3', tagsDb: 'd4' }),
    ).toBe(true);
  });
});

describe('reconcileSelection', () => {
  it('leaves a selection untouched when every id is still present', () => {
    const selection = { tasksDb: 'd1', notesDb: 'd2', projectsDb: '', tagsDb: '' };
    expect(reconcileSelection(selection, databases)).toEqual(selection);
  });

  it('clears a slot whose id is no longer in the fetched list', () => {
    const selection = { tasksDb: 'd1', notesDb: 'gone', projectsDb: 'd3', tagsDb: '' };
    expect(reconcileSelection(selection, databases)).toEqual({
      tasksDb: 'd1',
      notesDb: '',
      projectsDb: 'd3',
      tagsDb: '',
    });
  });
});

describe('fitsSlot', () => {
  it('fits a database with the right schema to its role', () => {
    expect(fitsSlot(REAL_PROJECTS_DB, 'projectsDb')).toBe(true);
  });

  it('rejects a same-named database with the wrong schema', () => {
    expect(fitsSlot(DECOY_PROJECTS_DB, 'projectsDb')).toBe(false);
  });

  it('fails open when the database carries no properties (older server)', () => {
    expect(fitsSlot(UNKNOWN_SCHEMA_DB, 'projectsDb')).toBe(true);
  });
});

describe('unfitReason', () => {
  it('is null when the database fits', () => {
    expect(unfitReason(REAL_PROJECTS_DB, 'projectsDb')).toBeNull();
  });

  it('is null when fitness is unknown (no properties)', () => {
    expect(unfitReason(UNKNOWN_SCHEMA_DB, 'projectsDb')).toBeNull();
  });

  it('names the missing properties for an unfit database', () => {
    const reason = unfitReason(DECOY_PROJECTS_DB, 'projectsDb');
    expect(reason).toContain('Meta');
    expect(reason).toContain('missing');
  });

  it('names every missing property, and says nothing will load when every view is broken', () => {
    // Pinned in full: this sentence is the only place a user learns what to rename in Notion.
    // DECOY_PROJECTS_DB is missing Archived, which every projects view filters on — so this is
    // the "whole role is unusable" branch, not the partial one below (issue #40).
    expect(unfitReason(DECOY_PROJECTS_DB, 'projectsDb')).toBe(
      'This database is missing Name, Archived, Meta, Latest Activity, Target Deadline. ' +
        'No list will load.',
    );
  });

  it('names only the views that actually break when the rest of the role still works', () => {
    expect(unfitReason(NOTES_MISSING_NOTE_DATE, 'notesDb')).toBe(
      "This database is missing Note Date. Meetings, Journal won't load — the rest will.",
    );
  });
});

describe('compatibleOptionsFor', () => {
  it('excludes databases whose schema does not fit the slot', () => {
    const dbs = [REAL_PROJECTS_DB, DECOY_PROJECTS_DB];
    const options = compatibleOptionsFor('projectsDb', dbs, EMPTY_SELECTION);
    expect(options.map((d) => d.id)).toEqual(['real-projects']);
  });

  it('still respects the cross-slot exclusivity availableOptionsFor already applies', () => {
    const dbs = [REAL_PROJECTS_DB, DECOY_PROJECTS_DB];
    const selection = { ...EMPTY_SELECTION, tasksDb: 'real-projects' };
    expect(compatibleOptionsFor('projectsDb', dbs, selection).map((d) => d.id)).toEqual([]);
  });
});

describe('optionsForSlot', () => {
  const dbs = [REAL_PROJECTS_DB, DECOY_PROJECTS_DB];

  it("keeps an unfit database that is this slot's own current choice", () => {
    // The #38 regression: a database confirmed through "Save anyway" is not offered by
    // compatibleOptionsFor, and a Select whose value is missing from its options renders the
    // placeholder — so a saved, in-use choice came back looking unselected.
    const selection = { ...EMPTY_SELECTION, projectsDb: 'decoy-projects' };
    const options = optionsForSlot('projectsDb', dbs, selection, false);
    expect(options.map((d) => d.id)).toEqual(['real-projects', 'decoy-projects']);
  });

  it('still hides unfit databases that are not the current choice', () => {
    const options = optionsForSlot('projectsDb', dbs, EMPTY_SELECTION, false);
    expect(options.map((d) => d.id)).toEqual(['real-projects']);
  });

  it('offers every database when showAll is on', () => {
    const options = optionsForSlot('projectsDb', dbs, EMPTY_SELECTION, true);
    expect(options.map((d) => d.id)).toEqual(['real-projects', 'decoy-projects']);
  });

  it('never offers a database taken by another slot, even as an unfit current choice', () => {
    // selection.projectsDb is what keeps the decoy visible; taking it for tasksDb must win.
    const selection = { ...EMPTY_SELECTION, tasksDb: 'decoy-projects' };
    expect(optionsForSlot('projectsDb', dbs, selection, false).map((d) => d.id)).toEqual([
      'real-projects',
    ]);
    expect(optionsForSlot('projectsDb', dbs, selection, true).map((d) => d.id)).toEqual([
      'real-projects',
    ]);
  });

  it('preserves the fetched order rather than surfacing the current choice', () => {
    const selection = { ...EMPTY_SELECTION, projectsDb: 'decoy-projects' };
    const reversed = [DECOY_PROJECTS_DB, REAL_PROJECTS_DB];
    expect(optionsForSlot('projectsDb', reversed, selection, false).map((d) => d.id)).toEqual([
      'decoy-projects',
      'real-projects',
    ]);
  });

  it('matches compatibleOptionsFor when the slot is empty', () => {
    expect(optionsForSlot('projectsDb', dbs, EMPTY_SELECTION, false)).toEqual(
      compatibleOptionsFor('projectsDb', dbs, EMPTY_SELECTION),
    );
  });
});

describe('autoSelect', () => {
  it('fills an empty slot with its one compatible candidate', () => {
    const dbs = [REAL_PROJECTS_DB, DECOY_PROJECTS_DB];
    expect(autoSelect(dbs, EMPTY_SELECTION).projectsDb).toBe('real-projects');
  });

  it('does not auto-select when two candidates fit the same slot', () => {
    const other = { ...REAL_PROJECTS_DB, id: 'real-projects-2' };
    const dbs = [REAL_PROJECTS_DB, other, DECOY_PROJECTS_DB];
    expect(autoSelect(dbs, EMPTY_SELECTION).projectsDb).toBe('');
  });

  it('never overrides a slot that already has a value, fitting or not', () => {
    const dbs = [REAL_PROJECTS_DB, DECOY_PROJECTS_DB];
    const selection = { ...EMPTY_SELECTION, projectsDb: 'decoy-projects' };
    expect(autoSelect(dbs, selection).projectsDb).toBe('decoy-projects');
  });

  it('resolves to a fixed point across slots — filling one frees a candidate for another', () => {
    // Two databases, each fitting exactly one distinct role: resolving tasksDb first must not
    // stop projectsDb from also being resolved in the same call.
    const taskDb = {
      id: 't1',
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
    const dbs = [REAL_PROJECTS_DB, taskDb];
    const result = autoSelect(dbs, EMPTY_SELECTION);
    expect(result.projectsDb).toBe('real-projects');
    expect(result.tasksDb).toBe('t1');
  });
});

describe('unfitSlots', () => {
  it('is empty when every selected database fits its slot', () => {
    const dbs = [REAL_PROJECTS_DB];
    const selection = { ...EMPTY_SELECTION, projectsDb: 'real-projects' };
    expect(unfitSlots(selection, dbs)).toEqual([]);
  });

  it('flags a slot whose selected database no longer fits — without clearing it', () => {
    const dbs = [DECOY_PROJECTS_DB];
    const selection = { ...EMPTY_SELECTION, projectsDb: 'decoy-projects' };
    expect(unfitSlots(selection, dbs)).toEqual(['projectsDb']);
    expect(selection.projectsDb).toBe('decoy-projects'); // untouched
  });

  it('ignores an empty slot', () => {
    expect(unfitSlots(EMPTY_SELECTION, [DECOY_PROJECTS_DB])).toEqual([]);
  });
});
