import { afterEach, describe, expect, it } from 'vitest';
import { _clearRegisteredSecretsForTests, redact, registerSecret } from '../../logging/redact';

afterEach(() => {
  _clearRegisteredSecretsForTests();
});

describe('redact', () => {
  it('scrubs a legacy secret_ token', () => {
    expect(redact('token=secret_abc123def456')).toBe('token=secret_***REDACTED***');
  });

  it('scrubs a current ntn_ token', () => {
    expect(redact('Authorization: Bearer ntn_abcdef1234567890')).toBe(
      'Authorization: Bearer ntn_***REDACTED***',
    );
  });

  it('scrubs a token embedded mid-sentence', () => {
    expect(redact('request failed for ntn_zzzz999999999 against /api/tasks')).toBe(
      'request failed for ntn_***REDACTED*** against /api/tasks',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(redact('GET /api/tasks/today 200 OK 42ms')).toBe('GET /api/tasks/today 200 OK 42ms');
  });

  it('collapses a long base64-looking blob', () => {
    const blob = 'A'.repeat(250);
    const result = redact(`payload=${blob}`);
    expect(result).toBe('payload=<base64 len=250>');
  });

  it('scrubs an exact-match registered secret regardless of shape', () => {
    registerSecret('my-dev-token-without-a-prefix');
    expect(redact('using my-dev-token-without-a-prefix for auth')).toBe(
      'using ***REDACTED*** for auth',
    );
  });

  it('scrubs a registered X-Notion-Config header value wherever it appears', () => {
    const header = 'eyJ0b2tlbiI6InNlY3JldF94eXoifQ==';
    registerSecret(header);
    expect(redact(`X-Notion-Config: ${header}`)).toBe('X-Notion-Config: ***REDACTED***');
  });

  it('ignores registering an empty or very short value', () => {
    registerSecret('');
    registerSecret('ab');
    expect(redact('ab')).toBe('ab');
  });
});
