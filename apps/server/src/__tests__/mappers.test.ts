import { describe, expect, it } from 'vitest';
import { pageTitle, pageToNote, pageToProject, pageToTag, pageToTask } from '../mappers';

const title = (text: string) => ({ title: [{ plain_text: text }] });

describe('pageTitle', () => {
  it('prefers Name, then Task, then Title', () => {
    expect(
      pageTitle({ properties: { Name: title('N'), Task: title('T'), Title: title('Ti') } }),
    ).toBe('N');
    expect(pageTitle({ properties: { Task: title('T'), Title: title('Ti') } })).toBe('T');
    expect(pageTitle({ properties: { Title: title('Ti') } })).toBe('Ti');
  });

  it('falls back to rich_text when there is no title array', () => {
    expect(pageTitle({ properties: { Name: { rich_text: [{ plain_text: 'RT' }] } } })).toBe('RT');
  });

  it('returns (untitled) when nothing matches', () => {
    expect(pageTitle({ properties: {} })).toBe('(untitled)');
    expect(pageTitle({ properties: { Name: { title: [] } } })).toBe('(untitled)');
  });
});

describe('pageToTask', () => {
  it('maps id, name, due and status', () => {
    expect(
      pageToTask({
        id: 't1',
        properties: {
          Name: title('Task 1'),
          Due: { date: { start: '2026-07-01' } },
          Status: { status: { name: 'Todo' } },
        },
      }),
    ).toEqual({ id: 't1', name: 'Task 1', dueDate: '2026-07-01', status: 'Todo' });
  });

  it('leaves due and status undefined when absent', () => {
    expect(pageToTask({ id: 't2', properties: { Name: title('Task 2') } })).toEqual({
      id: 't2',
      name: 'Task 2',
      dueDate: undefined,
      status: undefined,
    });
  });
});

describe('pageToNote', () => {
  it('resolves an emoji icon and last edited time', () => {
    expect(
      pageToNote({
        id: 'n1',
        icon: { emoji: '📝' },
        last_edited_time: '2026-01-01',
        properties: { Name: title('Note') },
      }),
    ).toEqual({ id: 'n1', name: 'Note', icon: '📝', lastEdited: '2026-01-01' });
  });

  it('falls back through external then file icon urls', () => {
    expect(
      pageToNote({
        id: 'n2',
        icon: { external: { url: 'http://x/e.png' } },
        properties: { Name: title('E') },
      }).icon,
    ).toBe('http://x/e.png');
    expect(
      pageToNote({
        id: 'n3',
        icon: { file: { url: 'http://x/f.png' } },
        properties: { Name: title('F') },
      }).icon,
    ).toBe('http://x/f.png');
  });

  it('leaves icon undefined when there is none', () => {
    expect(pageToNote({ id: 'n4', properties: { Name: title('None') } }).icon).toBeUndefined();
  });
});

describe('pageToProject', () => {
  it('maps id, name and status', () => {
    expect(
      pageToProject({
        id: 'p1',
        properties: { Name: title('Proj'), Status: { status: { name: 'Doing' } } },
      }),
    ).toEqual({
      id: 'p1',
      name: 'Proj',
      status: 'Doing',
    });
  });

  it('leaves status undefined when absent', () => {
    expect(
      pageToProject({ id: 'p2', properties: { Name: title('Proj2') } }).status,
    ).toBeUndefined();
  });
});

describe('pageToTag', () => {
  it('maps id and name only', () => {
    expect(pageToTag({ id: 'g1', properties: { Name: title('Tag') } })).toEqual({
      id: 'g1',
      name: 'Tag',
    });
  });
});
