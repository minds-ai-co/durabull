import { describe, expect, it } from 'bun:test'

import { createMcpBearerAuthMiddleware, MCP_SCOPE_DISCOVER } from './auth'
import { MCP_PROTOCOL_VERSION } from './constants'
import { createMcpRoutes } from './routes'
import {
  MCP_JSON_RPC_VERSION,
  postMcpJson,
  readMcpJsonResponse,
} from './testing/mcp-test-client'

const canonicalResourceUri = 'http://localhost:3000/mcp'
const resourceMetadataUrl = 'http://localhost:3000/.well-known/oauth-protected-resource'
const validAuthorization = 'Bearer valid'

function createTestAuthMiddleware() {
  return createMcpBearerAuthMiddleware({
    canonicalResourceUri,
    resourceMetadataUrl,
    requiredScopes: [MCP_SCOPE_DISCOVER],
    verifyAccessToken: async (token) => {
      if (token === 'valid') {
        return {
          accessToken: token,
          clientId: 'client',
          userId: 'user',
          scopes: [MCP_SCOPE_DISCOVER],
          accessTokenExpiresAt: new Date(Date.now() + 60_000),
          resource: canonicalResourceUri,
        }
      }
      return null
    },
  })
}

describe('createMcpRoutes', () => {
  const app = createMcpRoutes({
    version: 'test',
    allowedHosts: new Set(['localhost', '127.0.0.1', 'localhost:3000']),
    corsOrigins: ['http://localhost:3000'],
    middleware: [createTestAuthMiddleware()],
  })

  const postMcp = (
    body: Parameters<typeof postMcpJson>[2],
    options?: Parameters<typeof postMcpJson>[3]
  ) =>
    postMcpJson((path, init) => Promise.resolve(app.request(path, init)), '/', body, {
      authorization: validAuthorization,
      ...options,
    })

  it('returns 401 without bearer token', async () => {
    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { authorization: undefined }
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })

  it('rejects invalid Host header with 403', async () => {
    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { host: 'evil.example.com' }
    )

    expect(response.status).toBe(403)
  })

  it('rejects host header with fake port suffix', async () => {
    const response = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
      { host: 'localhost:3000.evil' }
    )

    expect(response.status).toBe(403)
  })

  it('requires session id for non-initialize requests', async () => {
    const response = await postMcp({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 2,
      method: 'tools/list',
      params: {},
    })

    expect(response.status).toBe(400)
  })

  it('initializes MCP session and lists ping tool', async () => {
    const initResponse = await postMcp({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    expect(initResponse.status).toBe(200)
    const initPayload = (await readMcpJsonResponse(initResponse)) as {
      result?: { protocolVersion?: string }
    }
    expect(initPayload.result?.protocolVersion).toBeTruthy()

    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      },
      { sessionId: sessionId ?? undefined }
    )

    const listResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/list',
        params: {},
      },
      { sessionId: sessionId ?? undefined }
    )

    expect(listResponse.status).toBe(200)
    const listPayload = (await readMcpJsonResponse(listResponse)) as {
      result?: { tools?: Array<{ name: string }> }
    }
    expect(listPayload.result?.tools?.map((tool) => tool.name)).toContain('ping')
  })

  it('calls ping and returns pong', async () => {
    const initResponse = await postMcp({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      },
      { sessionId: sessionId ?? undefined }
    )

    const callResponse = await postMcp(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {},
        },
      },
      { sessionId: sessionId ?? undefined }
    )

    expect(callResponse.status).toBe(200)
    const callPayload = (await readMcpJsonResponse(callResponse)) as {
      result?: { content?: Array<{ type: string; text?: string }> }
    }
    expect(callPayload.result?.content?.[0]?.text).toBe('pong')
  })

  it('returns isError envelope for typed tool not_found errors', async () => {
    class NotFoundToolError extends Error {
      readonly code = 'not_found'
    }

    const appWithReadTool = createMcpRoutes({
      version: 'test',
      allowedHosts: new Set(['localhost', '127.0.0.1', 'localhost:3000']),
      corsOrigins: ['http://localhost:3000'],
      middleware: [createTestAuthMiddleware()],
      requestContextResolver: () => ({
        principal: {
          type: 'delegated_user',
          principalId: 'principal-test',
          userId: 'user',
        },
        correlationId: 'corr-test',
      }),
      readTools: {
        listConnections: async () => {
          throw new NotFoundToolError('Connection missing for test')
        },
      },
    })

    const postMcpReadTool = (
      body: Parameters<typeof postMcpJson>[2],
      options?: Parameters<typeof postMcpJson>[3]
    ) =>
      postMcpJson((path, init) => Promise.resolve(appWithReadTool.request(path, init)), '/', body, {
        authorization: validAuthorization,
        ...options,
      })

    const initResponse = await postMcpReadTool({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    const sessionId = initResponse.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()

    await postMcpReadTool(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        method: 'notifications/initialized',
      },
      { sessionId: sessionId ?? undefined }
    )

    const callResponse = await postMcpReadTool(
      {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: {
            pageSize: 10,
          },
        },
      },
      { sessionId: sessionId ?? undefined }
    )

    expect(callResponse.status).toBe(200)
    const payload = (await readMcpJsonResponse(callResponse)) as {
      result?: {
        isError?: boolean
        content?: Array<{ type: string; text?: string }>
      }
    }
    expect(payload.result?.isError).toBe(true)
    const errorPayload = JSON.parse(payload.result?.content?.[0]?.text ?? '{}') as {
      error?: { code?: string; message?: string }
    }
    expect(errorPayload.error?.code).toBe('not_found')
    expect(errorPayload.error?.message).toBe('Resource not found.')
  })
})
