import { StreamableHTTPTransport } from '@hono/mcp'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { MCP_JSON_RPC_VERSION } from '../constants'
import { type McpRequestContext, runWithMcpRequestContext } from '../request-context'
import { type CreateMcpServerOptions, createMcpServer } from '../server/create-mcp-server'

export interface StatelessMcpHandlerOptions {
  version: string
  allowedHosts: ReadonlySet<string>
  serverOptions?: Omit<CreateMcpServerOptions, 'version'>
}

/**
 * Stateless Streamable HTTP handling for `/mcp`.
 *
 * Every `POST` is served by a fresh `McpServer` + transport that exist only for that HTTP request
 * (`sessionIdGenerator: undefined`, so no `Mcp-Session-Id` is issued or required). Nothing about a
 * client outlives its request, which lets any replica behind a non-sticky load balancer serve any
 * request; an `Mcp-Session-Id` still sent by a client (e.g. one cached from an older, stateful
 * deployment) is ignored. Auth, scopes, and policy are resolved per HTTP request by the `/mcp`
 * middleware chain and reach tool handlers through `requestContext`.
 *
 * Deliberately unsupported, because no Durabull tool relies on them:
 * - `GET /mcp` standalone SSE stream (server-initiated notifications/requests outside a POST) → 405
 * - `DELETE /mcp` session termination (there is no session) → 405
 * - resumability / `Last-Event-ID` replay (no event store was ever configured)
 *
 * Responses to requests still stream as SSE on the `POST` itself.
 */
export function createStatelessMcpHandler(options: StatelessMcpHandlerOptions) {
  const allowedHostList = [...options.allowedHosts]

  async function handleRequest(
    c: Context,
    requestContext?: McpRequestContext
  ): Promise<Response | undefined> {
    if (c.req.method !== 'POST') {
      return methodNotAllowedResponse()
    }

    const server = createMcpServer({ version: options.version, ...options.serverOptions })
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: true,
      allowedHosts: allowedHostList,
    })
    const release = releaseOnce(server)

    try {
      await server.connect(transport)
      const response = await runWithMcpRequestContext(requestContext, () =>
        transport.handleRequest(c)
      )
      if (!response) {
        release()
        return response
      }
      return releaseWhenBodySettles(response, release)
    } catch (error) {
      release()
      if (error instanceof HTTPException) {
        throw error
      }

      console.error('[mcp] Request failed:', error)
      return jsonRpcErrorResponse(500, -32603, 'Internal error')
    }
  }

  return { handleRequest }
}

function releaseOnce(server: McpServer): () => void {
  let released = false
  return () => {
    if (released) return
    released = true
    server.close().catch(() => {
      // Transport already closed.
    })
  }
}

/**
 * Closes the per-request server once the response body has been fully delivered, or the client
 * went away. SSE bodies only end after the tool result has been written, so closing any earlier
 * would truncate the response.
 */
function releaseWhenBodySettles(response: Response, release: () => void): Response {
  const body = response.body
  if (!body) {
    release()
    return response
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  body.pipeTo(writable).then(release, release)
  return new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function methodNotAllowedResponse(): Response {
  return jsonRpcErrorResponse(
    405,
    -32_000,
    'Method not allowed: this MCP endpoint is stateless and only accepts POST.',
    { Allow: 'POST' }
  )
}

function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
  headers?: Record<string, string>
): Response {
  return Response.json(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      error: { code, message },
      id: null,
    },
    { status, headers }
  )
}
