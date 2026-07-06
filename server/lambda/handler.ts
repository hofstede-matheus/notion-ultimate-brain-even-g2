import { config, assertConfig } from '../config'
import { ROUTES } from '../routes'
import { matchRoute } from './match-route'

assertConfig(config)

// Minimal shape of a Lambda Function URL event/response — avoids taking a
// dependency on @types/aws-lambda since this file must stay dependency-free.
interface LambdaFunctionUrlEvent {
  requestContext: { http: { method: string } }
  rawPath: string
  body?: string | null
  isBase64Encoded?: boolean
}

interface LambdaFunctionUrlResult {
  statusCode: number
  headers: Record<string, string>
  body: string
}

function parseBody(event: LambdaFunctionUrlEvent): unknown {
  if (!event.body) return undefined
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export async function handler(event: LambdaFunctionUrlEvent): Promise<LambdaFunctionUrlResult> {
  const method = event.requestContext.http.method
  const path = event.rawPath

  const match = matchRoute(ROUTES, method, path)
  if (!match) {
    return {
      statusCode: 404,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: `No route for ${method} ${path}` }),
    }
  }

  const result = await match.route.handler({ params: match.params, body: parseBody(event) })

  return {
    statusCode: result.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result.body),
  }
}
