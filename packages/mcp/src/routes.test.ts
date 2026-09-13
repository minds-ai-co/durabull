import { describe, expect, it } from 'bun:test'

import { createMcpBearerAuthMiddleware, MCP_SCOPE_DISCOVER } from './auth'
import { MCP_PROTOCOL_VERSION } from './constants'
import { type CreateMcpRoutesOptions, createMcpRoutes } from './routes'
import {
  MCP_JSON_RPC_VERSION,
  mcpHeaders,
  postMcpJson,
  readMcpJsonResponse,
} from './testing/mcp-test-client'

const canonicalResourceUri = 'http://localhost:3000/mcp'
const resourceMetadataUrl = 'http://localhost:3000/.well-known/oauth-protected-resource'
const validAuthorization = 'Bearer valid'

const initializeRequest = {
  jsonrpc: MCP_JSON_RPC_VERSION,
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
}

const initializedNotification = {
  jsonrpc: MCP_JSON_RPC_VERSION,
  method: 'notifications/initialized',
}

const toolsListRequest = {
  jsonrpc: MCP_JSON_RPC_VERSION,
  id: 2,
  method: 'tools/list',
  params: {},
}

const pingCallRequest = {
  jsonrpc: MCP_JSON_RPC_VERSION,
  id: 3,
  method: 'tools/call',
  params: { name: 'ping', arguments: {} },
}

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

function createTestRoutes(overrides: Partial<CreateMcpRoutesOptions> = {}) {
  return createMcpRoutes({
    version: 'test',
    allowedHosts: new Set(['localhost', '127.0.0.1', 'localhost:3000']),
    corsOrigins: ['http://localhost:3000'],
    middleware: [createTestAuthMiddleware()],
    ...overrides,
  })
}

function createPoster(app: ReturnType<typeof createMcpRoutes>) {
  return (body: Parameters<typeof postMcpJson>[2], options?: Parameters<typeof postMcpJson>[3]) =>
    postMcpJson((path, init) => Promise.resolve(app.request(path, init)), '/', body, {
      authorization: validAuthorization,
      ...options,
    })
}

async function expectPong(response: Response, expectedId: number | string = 3) {
  expect(response.status).toBe(200)
  expect(response.headers.get('mcp-session-id')).toBeNull()
  const payload = (await readMcpJsonResponse(response)) as {
    id?: number | string
    result?: { content?: Array<{ type: string; text?: string }> }
  }
  expect(payload.id).toBe(expectedId)
  expect(payload.result?.content?.[0]?.text).toBe('pong')
}

describe('createMcpRoutes', () => {
  const app = createTestRoutes()
  const postMcp = createPoster(app)

  it('returns 401 without bearer token', async () => {
    const response = await postMcp(initializeRequest, { authorization: undefined })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })

  it('returns 401 without bearer token on non-initialize requests', async () => {
    const response = await postMcp(pingCallRequest, { authorization: undefined })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(resourceMetadataUrl)
  })

  it('rejects invalid Host header with 403', async () => {
    const response = await postMcp(initializeRequest, { host: 'evil.example.com' })

    expect(response.status).toBe(403)
  })

  it('rejects host header with fake port suffix', async () => {
    const response = await postMcp(initializeRequest, { host: 'localhost:3000.evil' })

    expect(response.status).toBe(403)
  })

  it('initializes without issuing a session id', async () => {
    const initResponse = await postMcp(initializeRequest)

    expect(initResponse.status).toBe(200)
    expect(initResponse.headers.get('mcp-session-id')).toBeNull()
    const initPayload = (await readMcpJsonResponse(initResponse)) as {
      result?: { protocolVersion?: string; serverInfo?: { name?: string } }
    }
    expect(initPayload.result?.protocolVersion).toBeTruthy()
    expect(initPayload.result?.serverInfo?.name).toBe('durabull-mcp')
  })

  it('serves initialize, tools/list, and ping as consecutive requests without a session id', async () => {
    const initResponse = await postMcp(initializeRequest)
    expect(initResponse.status).toBe(200)

    const initializedResponse = await postMcp(initializedNotification)
    expect(initializedResponse.status).toBe(202)

    const listResponse = await postMcp(toolsListRequest)
    expect(listResponse.status).toBe(200)
    expect(listResponse.headers.get('mcp-session-id')).toBeNull()
    const listPayload = (await readMcpJsonResponse(listResponse)) as {
      result?: { tools?: Array<{ name: string }> }
    }
    expect(listPayload.result?.tools?.map((tool) => tool.name)).toContain('ping')

    await expectPong(await postMcp(pingCallRequest))
    await expectPong(await postMcp(pingCallRequest))
  })

  it('serves requests on a different replica than the one that handled initialize', async () => {
    const replicaA = createPoster(createTestRoutes())
    const replicaB = createPoster(createTestRoutes())

    expect((await replicaA(initializeRequest)).status).toBe(200)

    const listResponse = await replicaB(toolsListRequest)
    expect(listResponse.status).toBe(200)
    const listPayload = (await readMcpJsonResponse(listResponse)) as {
      result?: { tools?: Array<{ name: string }> }
    }
    expect(listPayload.result?.tools?.map((tool) => tool.name)).toContain('ping')

    await expectPong(await replicaB(pingCallRequest))
    await expectPong(await replicaA(pingCallRequest))
  })

  it('ignores a stale Mcp-Session-Id left over from a stateful deployment', async () => {
    await expectPong(
      await postMcp(pingCallRequest, { sessionId: 'stale-session-from-another-replica' })
    )
  })

  it('keeps concurrent requests isolated', async () => {
    const ids = [101, 102, 103, 104, 105]
    const responses = await Promise.all(ids.map((id) => postMcp({ ...pingCallRequest, id })))

    for (const [index, response] of responses.entries()) {
      await expectPong(response, ids[index])
    }
  })

  it('returns 405 for GET and DELETE because there is no session or standalone SSE stream', async () => {
    for (const method of ['GET', 'DELETE']) {
      const response = await app.request('/', {
        method,
        headers: mcpHeaders('localhost:3000', undefined, validAuthorization),
      })

      expect(response.status).toBe(405)
      expect(response.headers.get('Allow')).toBe('POST')
    }
  })

  it('returns isError envelope for typed tool not_found errors', async () => {
    class NotFoundToolError extends Error {
      readonly code = 'not_found'
    }

    const postMcpReadTool = createPoster(
      createTestRoutes({
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
    )

    const initResponse = await postMcpReadTool(initializeRequest)
    expect(initResponse.status).toBe(200)

    const callResponse = await postMcpReadTool({
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_connections',
        arguments: {
          pageSize: 10,
        },
      },
    })

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
