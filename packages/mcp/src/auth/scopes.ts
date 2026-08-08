/** Phase-1 MCP scopes (see tasks/mcp-implementation-master-plan.md §6.2). */
export const MCP_SCOPE_DISCOVER = 'mcp:discover'
export const MCP_SCOPE_JOBS_READ = 'mcp:jobs:read'
export const MCP_SCOPE_FAILURES_READ = 'mcp:failures:read'
export const MCP_SCOPE_LOGS_READ = 'mcp:logs:read'
export const MCP_SCOPE_DIAGNOSTICS_READ = 'mcp:diagnostics:read'

export const MCP_PHASE1_SCOPES = [
  MCP_SCOPE_DISCOVER,
  MCP_SCOPE_JOBS_READ,
  MCP_SCOPE_FAILURES_READ,
  MCP_SCOPE_LOGS_READ,
  MCP_SCOPE_DIAGNOSTICS_READ,
] as const

export const OIDC_CORE_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const
export const MCP_OAUTH_SCOPES_SUPPORTED = [...OIDC_CORE_SCOPES, ...MCP_PHASE1_SCOPES] as const

export type McpPhase1Scope = (typeof MCP_PHASE1_SCOPES)[number]

/** Minimum scope required to use MCP transport (initialize, tools/list, ping). */
export const MCP_TRANSPORT_REQUIRED_SCOPES = [MCP_SCOPE_DISCOVER] as const

export function parseScopeString(scopes: string): string[] {
  return scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
}

export function tokenHasScopes(tokenScopes: readonly string[], required: readonly string[]): boolean {
  const granted = new Set(tokenScopes)
  return required.every((scope) => granted.has(scope))
}

export function missingScopes(
  tokenScopes: readonly string[],
  required: readonly string[]
): string[] {
  const granted = new Set(tokenScopes)
  return required.filter((scope) => !granted.has(scope))
}
