/** MCP Phase 1 scope strings (duplicated here to avoid pulling server MCP bundle into the web client). */
export const MCP_SCOPE_DISCOVER = 'mcp:discover'
export const MCP_SCOPE_JOBS_READ = 'mcp:jobs:read'
export const MCP_SCOPE_LOGS_READ = 'mcp:logs:read'
export const MCP_SCOPE_FAILURES_READ = 'mcp:failures:read'
export const MCP_SCOPE_DIAGNOSTICS_READ = 'mcp:diagnostics:read'

export const MCP_PHASE1_SCOPES = [
  MCP_SCOPE_DISCOVER,
  MCP_SCOPE_JOBS_READ,
  MCP_SCOPE_LOGS_READ,
  MCP_SCOPE_FAILURES_READ,
  MCP_SCOPE_DIAGNOSTICS_READ,
] as const

export type McpPhase1Scope = (typeof MCP_PHASE1_SCOPES)[number]

export function isKnownMcpPhase1Scope(scope: string): scope is McpPhase1Scope {
  return (MCP_PHASE1_SCOPES as readonly string[]).includes(scope)
}
