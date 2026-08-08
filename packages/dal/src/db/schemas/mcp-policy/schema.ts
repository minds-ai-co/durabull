import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { baseColumns } from '../common'
import { oauthApplication } from '../oauth-mcp/schema'
import { organization } from '../organization/schema'
import { user } from '../user/schema'

export const mcpPrincipalTypes = ['delegated_user', 'service_account'] as const
export type McpPrincipalType = (typeof mcpPrincipalTypes)[number]

/**
 * Machine principal scoped to a single organization.
 * Optionally links to an OAuth client used by Better Auth token issuance.
 */
export const mcpServiceAccount = pgTable(
  'mcp_service_account',
  {
    ...baseColumns,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    oauthClientId: text('oauth_client_id').references(() => oauthApplication.clientId, {
      onDelete: 'set null',
    }),
    disabled: boolean('disabled').notNull().default(false),
  },
  (table) => [
    index('mcp_service_account_org_idx').on(table.organizationId),
    uniqueIndex('mcp_service_account_oauth_client_id_unique').on(table.oauthClientId),
  ]
)

/**
 * Rotatable secrets for service accounts.
 * Only hashed values are stored; raw tokens are returned once at creation time.
 */
export const mcpServiceAccountSecret = pgTable(
  'mcp_service_account_secret',
  {
    ...baseColumns,
    serviceAccountId: uuid('service_account_id')
      .notNull()
      .references(() => mcpServiceAccount.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default('primary'),
    secretHash: text('secret_hash').notNull(),
    secretLastFour: text('secret_last_four').notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('mcp_service_account_secret_account_idx').on(table.serviceAccountId)]
)

/**
 * Explicit policy bindings per principal (delegated user or service account).
 * toolName null means scope is granted for all tools.
 */
export const mcpPolicyBinding = pgTable(
  'mcp_policy_binding',
  {
    ...baseColumns,
    principalType: text('principal_type').$type<McpPrincipalType>().notNull(),
    principalId: text('principal_id').notNull(),
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),
    toolName: text('tool_name'),
    scope: text('scope').notNull(),
    disabled: boolean('disabled').notNull().default(false),
  },
  (table) => [
    index('mcp_policy_binding_principal_idx').on(table.principalType, table.principalId),
    index('mcp_policy_binding_org_idx').on(table.organizationId),
  ]
)

/**
 * Policy decision audit trail (written for every MCP tools/call authorization decision).
 */
export const mcpAuditEvent = pgTable(
  'mcp_audit_event',
  {
    ...baseColumns,
    correlationId: text('correlation_id').notNull(),
    principalType: text('principal_type').$type<McpPrincipalType>().notNull(),
    principalId: text('principal_id').notNull(),
    organizationId: text('organization_id'),
    connectionId: text('connection_id'),
    toolName: text('tool_name').notNull(),
    requiredScopes: text('required_scopes').notNull(),
    granted: boolean('granted').notNull(),
    denialReason: text('denial_reason'),
    inputHash: text('input_hash'),
    responseClass: text('response_class'),
  },
  (table) => [
    index('mcp_audit_event_correlation_idx').on(table.correlationId),
    index('mcp_audit_event_principal_idx').on(table.principalType, table.principalId),
    index('mcp_audit_event_tool_idx').on(table.toolName),
  ]
)
