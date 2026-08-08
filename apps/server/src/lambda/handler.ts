import { ROUTES, runRoute } from '../routes';
import { flushLogger, logger, summarizeFailure } from './logger';
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

  // Two rules hold this together, and both are load-bearing:
  //
  // 1. Never pass event.headers/tenantHeader/tokenHeader to the logger. It
  //    doesn't accept them, so this can't happen by accident — don't widen
  //    the signature to make it possible.
  // 2. Log `match.route.path` (the pattern) and never `path` itself. The raw
  //    path embeds Notion page IDs; the pattern doesn't. An unmatched request
  //    has no pattern to report, and its raw path is exactly the kind of thing
  //    worth not writing down, so it logs as 'unmatched'.
  //
  // Successful requests log nothing at all; summarizeFailure returns undefined
  // and there is no second call site that logs on the happy path.
  const entry = summarizeFailure(method, match ? match.route.path : 'unmatched', result);
  if (entry) {
    logger.error(entry, 'request failed');
    await flushLogger();
  }

  return {
    statusCode: result.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result.body),
  };
}
