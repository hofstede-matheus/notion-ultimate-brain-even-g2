import type { Route } from '../routes';

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

function tryMatch(
  route: Route,
  method: string,
  pathSegments: string[],
): Record<string, string> | undefined {
  if (route.method !== method) return undefined;

  const patternSegments = route.path.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return undefined;

  const params: Record<string, string> = {};
  const matched = patternSegments.every((pattern, i) => {
    if (pattern.startsWith(':')) {
      params[pattern.slice(1)] = pathSegments[i];
      return true;
    }
    return pattern === pathSegments[i];
  });
  return matched ? params : undefined;
}

export function matchRoute(routes: Route[], method: string, path: string): RouteMatch | undefined {
  const pathSegments = path.split('/').filter(Boolean).map(decodeURIComponent);
  for (const route of routes) {
    const params = tryMatch(route, method, pathSegments);
    if (params) return { route, params };
  }
  return undefined;
}
