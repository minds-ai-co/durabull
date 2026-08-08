import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/** Phase-1 smoke tools only (transport validation). Domain tools register in PR-05. */
export function registerSmokeTools(server: McpServer): void {
  server.registerTool(
    'ping',
    {
      description: 'Health check for MCP transport wiring (non-domain smoke tool).',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: 'text', text: 'pong' }],
    })
  )
}
