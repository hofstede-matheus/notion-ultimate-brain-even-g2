import { describe, expect, it } from 'vitest';
import { parseTenant } from '../tenant';

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

const validPayload = {
  token: 'secret_token',
  tasksDb: 'tasks-id',
  notesDb: 'notes-id',
  projectsDb: 'projects-id',
  tagsDb: 'tags-id',
};

describe('parseTenant', () => {
  it('decodes a valid header into a Tenant without excludeProjectId', () => {
    const tenant = parseTenant(encode(validPayload));
    expect(tenant).toEqual({
      token: 'secret_token',
      db: {
        tasks: 'tasks-id',
        notes: 'notes-id',
        projects: 'projects-id',
        tags: 'tags-id',
      },
    });
  });

  it('includes excludeProjectId when it is a non-empty string', () => {
    const tenant = parseTenant(encode({ ...validPayload, excludeProjectId: 'proj-x' }));
    expect(tenant?.db.excludeProjectId).toBe('proj-x');
  });

  it('omits excludeProjectId when it is an empty string', () => {
    const tenant = parseTenant(encode({ ...validPayload, excludeProjectId: '' }));
    expect(tenant?.db).not.toHaveProperty('excludeProjectId');
  });

  it('returns null for a missing/undefined header', () => {
    expect(parseTenant(undefined)).toBeNull();
    expect(parseTenant('')).toBeNull();
  });

  it('returns null for an array header value', () => {
    expect(parseTenant(['a', 'b'])).toBeNull();
  });

  it('returns null when the payload is not valid base64 JSON', () => {
    // decodes to bytes that are not JSON
    expect(parseTenant(Buffer.from('not json at all').toString('base64'))).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const { tasksDb, ...withoutTasks } = validPayload;
    expect(parseTenant(encode(withoutTasks))).toBeNull();
  });

  it('returns null when a required field is an empty string', () => {
    expect(parseTenant(encode({ ...validPayload, token: '' }))).toBeNull();
  });

  it('returns null when a required field is the wrong type', () => {
    expect(parseTenant(encode({ ...validPayload, notesDb: 42 }))).toBeNull();
  });
});
