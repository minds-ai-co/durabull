import { Hono } from 'hono'
import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'
import type { McpRequestContext } from './request-context'

import { createHostValidationMiddleware } from './middleware/host-validation'
import type { RegisterReadToolsOptions } from './tools/register-read-tools'
import { createStatelessMcpHandler } from './transport/stateless-transport'

export interface CreateMcpRoutesOptions {
  /** App version reported in MCP server metadata. */
  version: string
  /** Host allowlist (required — set at API ingress from APP_BASE_URL). */
  allowedHosts: ReadonlySet<string>
  /** CORS origins for /mcp. */
  corsOrigins: string[]
  /**
   * Middleware applied after host validation and body limit.
   * PR-03: bearer token validation goes here.
   */
  middleware?: MiddlewareHandler[]
  readTools?: RegisterReadToolsOptions
  /** Optional request-scoped context resolver used by MCP tool handlers. */
  requestContextResolver?: (context: Context) => McpRequestContext | undefined
  /** When false, only exact host entries match (recommended for production). */
  allowHostnameWithoutPort?: boolean
}

export function createMcpRoutes(options: CreateMcpRoutesOptions): Hono {
  const mcpHandler = createStatelessMcpHandler({
    version: options.version,
    allowedHosts: options.allowedHosts,
    serverOptions: { readTools: options.readTools },
  })

  const routes = new Hono()

  routes.use(
    '*',
    cors({
      origin: options.corsOrigins,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'mcp-session-id',
        'Mcp-Protocol-Version',
        'Last-Event-ID',
      ],
      exposeHeaders: ['mcp-session-id', 'WWW-Authenticate'],
    })
  )

  routes.use(
    '*',
    createHostValidationMiddleware(options.allowedHosts, {
      allowHostnameWithoutPort: options.allowHostnameWithoutPort,
    })
  )

  routes.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) =>
        c.json({ error: 'Payload Too Large', message: 'Request body exceeds 1MB limit' }, 413),
    })
  )

  for (const middleware of options.middleware ?? []) {
    routes.use('*', middleware)
  }

  // Stateless Streamable HTTP (@hono/mcp): POST is served by a per-request server, so any replica
  // can serve any request; GET / DELETE (and other methods) answer 405 after auth has run.
  routes.all('/', async (c) => mcpHandler.handleRequest(c, options.requestContextResolver?.(c)))

  return routes
}
