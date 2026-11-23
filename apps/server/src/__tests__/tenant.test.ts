import { describe, expect, it } from 'vitest';
import { parseTenant, parseToken } from '../tenant';

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
  it('decodes a valid header into a Tenant', () => {
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

  it('keeps notesHasContent: false on the tenant (issue #54)', () => {
    const tenant = parseTenant(encode({ ...validPayload, notesHasContent: false }));
    expect(tenant?.notesHasContent).toBe(false);
  });

  it('treats an absent, true or malformed notesHasContent as "has it" (left off the tenant)', () => {
    for (const notesHasContent of [undefined, true, 'false', 0, null]) {
      const tenant = parseTenant(encode({ ...validPayload, notesHasContent }));
      expect(tenant).not.toBeNull();
      expect(tenant).not.toHaveProperty('notesHasContent');
    }
  });

  it('keeps a non-empty timeZone on the tenant', () => {
    const tenant = parseTenant(encode({ ...validPayload, timeZone: 'Asia/Tokyo' }));
    expect(tenant?.timeZone).toBe('Asia/Tokyo');
  });

  it('omits timeZone when the payload field is missing or empty', () => {
    expect(parseTenant(encode(validPayload))).not.toHaveProperty('timeZone');
    expect(parseTenant(encode({ ...validPayload, timeZone: '' }))).not.toHaveProperty('timeZone');
  });
});

describe('parseToken', () => {
  it('returns a non-empty header value as-is', () => {
    expect(parseToken('ntn_abc123')).toBe('ntn_abc123');
  });

  it('returns null for a missing/undefined header', () => {
    expect(parseToken(undefined)).toBeNull();
    expect(parseToken('')).toBeNull();
  });

  it('returns null for an array header value', () => {
    expect(parseToken(['a', 'b'])).toBeNull();
  });
});
