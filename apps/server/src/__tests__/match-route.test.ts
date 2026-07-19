import { describe, expect, it } from 'vitest';
import { matchRoute } from '../lambda/match-route';
import type { Route } from '../routes';

const ok = async () => ({ status: 200, body: {} });

const routes: Route[] = [
  { method: 'GET', path: '/api/tasks/inbox', handler: ok },
  { method: 'GET', path: '/api/tasks/:id/metadata', handler: ok },
  { method: 'POST', path: '/api/tasks', handler: ok },
  { method: 'GET', path: '/api/tasks', handler: ok },
];

describe('matchRoute', () => {
  it('matches a static path with no params', () => {
    const m = matchRoute(routes, 'GET', '/api/tasks/inbox');
    expect(m?.route.path).toBe('/api/tasks/inbox');
    expect(m?.params).toEqual({});
  });

  it('disambiguates by method', () => {
    expect(matchRoute(routes, 'POST', '/api/tasks')?.route.method).toBe('POST');
    expect(matchRoute(routes, 'GET', '/api/tasks')?.route.method).toBe('GET');
  });

  it('extracts a named param', () => {
    const m = matchRoute(routes, 'GET', '/api/tasks/abc123/metadata');
    expect(m?.route.path).toBe('/api/tasks/:id/metadata');
    expect(m?.params).toEqual({ id: 'abc123' });
  });

  it('decodes percent-encoded segments', () => {
    expect(matchRoute(routes, 'GET', '/api/tasks/a%20b/metadata')?.params).toEqual({ id: 'a b' });
  });

  it('returns undefined on segment-count mismatch', () => {
    expect(matchRoute(routes, 'GET', '/api/tasks/inbox/extra')).toBeUndefined();
  });

  it('returns undefined when the method does not match any route', () => {
    expect(matchRoute(routes, 'DELETE', '/api/tasks/inbox')).toBeUndefined();
  });

  it('returns the first matching route', () => {
    const first: Route = { method: 'GET', path: '/api/dup', handler: ok };
    const second: Route = { method: 'GET', path: '/api/dup', handler: ok };
    expect(matchRoute([first, second], 'GET', '/api/dup')?.route).toBe(first);
  });
});
