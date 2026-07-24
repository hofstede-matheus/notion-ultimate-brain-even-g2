import { describe, expect, it } from 'vitest';
import {
  availableOptionsFor,
  EMPTY_SELECTION,
  isSelectionComplete,
  reconcileSelection,
} from '../../web/screens/SettingsForm/dbSelection';

const databases = [
  { id: 'd1', name: 'Tasks' },
  { id: 'd2', name: 'Notes' },
  { id: 'd3', name: 'Projects' },
];

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
