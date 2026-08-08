export {
  createMcpBearerAuthMiddleware,
  type McpBearerAuthMiddlewareOptions,
} from './bearer-middleware'
export {
  getCanonicalMcpResourceUri,
  getMcpProtectedResourceMetadataUrl,
} from './resource-uri'
export {
  MCP_OAUTH_SCOPES_SUPPORTED,
  MCP_PHASE1_SCOPES,
  OIDC_CORE_SCOPES,
  MCP_SCOPE_DIAGNOSTICS_READ,
  MCP_SCOPE_DISCOVER,
  MCP_SCOPE_FAILURES_READ,
  MCP_SCOPE_JOBS_READ,
  MCP_SCOPE_LOGS_READ,
  MCP_TRANSPORT_REQUIRED_SCOPES,
  missingScopes,
  parseScopeString,
  tokenHasScopes,
} from './scopes'
export type { McpAccessTokenClaims, McpTokenValidationResult } from './types'
export { isMcpAccessTokenExpired, toAccessTokenExpiry } from './session'
export { extractBearerToken, validateMcpAccessTokenClaims } from './validate-token'
export { normalizeResourceUri } from './normalize-resource-uri'
export {
  buildMcpInsufficientScopeResponse,
  buildMcpMissingBearerResponse,
  buildMcpUnauthorizedResponse,
} from './json-rpc-auth-response'
export { createMcpTokenValidationCache } from './token-cache'
export { buildWwwAuthenticateChallenge, mcpAuthResponseHeaders } from './www-authenticate'
