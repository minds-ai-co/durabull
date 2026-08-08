import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { MCP_SERVER_NAME } from '../constants'
import { type RegisterReadToolsOptions, registerReadTools } from '../tools/register-read-tools'
import { registerSmokeTools } from '../tools/register-smoke-tools'

export interface CreateMcpServerOptions {
  version: string
  readTools?: RegisterReadToolsOptions
}

export function createMcpServer({ version, readTools }: CreateMcpServerOptions): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version,
  })

  registerSmokeTools(server)
  registerReadTools(server, readTools ?? {})

  return server
}
