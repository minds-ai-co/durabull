import { describe, expect, it } from 'bun:test'

import {
  buildMcpAuthorizeResumeUrl,
  labelConsentScopes,
  parseConsentScopeList,
  parseMcpOAuthConsentSearch,
} from './mcp-consent'

describe('mcp-consent helpers', () => {
  it('parses consent search params', () => {
    expect(
      parseMcpOAuthConsentSearch({
        consent_code: 'abc',
        client_id: 'client-1',
        scope: 'openid mcp:discover',
      })
    ).toEqual({
      consent_code: 'abc',
      client_id: 'client-1',
      scope: 'openid mcp:discover',
    })
  })

  it('labels MCP scopes for the consent screen', () => {
    const labels = labelConsentScopes(
      parseConsentScopeList('mcp:discover mcp:jobs:read mcp:failures:write')
    )
    expect(labels.map((entry) => entry.scope)).toEqual([
      'mcp:discover',
      'mcp:jobs:read',
      'mcp:failures:write',
    ])
    expect(labels[0]?.title).toBe('MCP discovery')
    expect(labels[2]?.title).toBe('Resolve failures')
  })

  it('builds authorize resume URLs with consent prompt', () => {
    const url = buildMcpAuthorizeResumeUrl({
      client_id: 'client',
      redirect_uri: 'http://127.0.0.1/callback',
      response_type: 'code',
      scope: 'openid mcp:discover',
    })
    expect(url).toContain('/api/auth/mcp/authorize')
    expect(url).toContain('prompt=consent')
  })
})
