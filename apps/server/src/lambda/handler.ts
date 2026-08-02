import { ROUTES, runRoute } from '../routes';
import { flushLogger, logger, summarizeResult } from './logger';
import { matchRoute } from './match-route';

// Minimal shape of a Lambda Function URL event/response — avoids taking a
// dependency on @types/aws-lambda since this file must stay dependency-free.
export interface LambdaFunctionUrlEvent {
  requestContext: { http: { method: string } };
  rawPath: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface LambdaFunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function parseBody(event: LambdaFunctionUrlEvent): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function handler(event: LambdaFunctionUrlEvent): Promise<LambdaFunctionUrlResult> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const start = Date.now();

  const match = matchRoute(ROUTES, method, path);
  const result = match
    ? await runRoute(match.route, {
        params: match.params,
        body: parseBody(event),
        // Function URL lowercases incoming header names.
        tenantHeader: event.headers?.['x-notion-config'],
        tokenHeader: event.headers?.['x-notion-token'],
        cursor: event.queryStringParameters?.cursor,
      })
    : { status: 404, body: { error: `No route for ${method} ${path}` } };

  // Never pass event.headers/tenantHeader/tokenHeader into the logger — only
  // `result` carries the tenant's Notion token risk, and it never contains
  // one (routes.ts never echoes the token back in a response body).
  logger.info(summarizeResult(method, path, result, Date.now() - start), 'request');
  await flushLogger();

  return {
    statusCode: result.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result.body),
  };
}
