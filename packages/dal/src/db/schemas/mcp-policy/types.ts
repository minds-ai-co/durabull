import type {
  mcpAuditEvent,
  mcpPolicyBinding,
  mcpServiceAccount,
  mcpServiceAccountSecret,
} from './schema'

export type McpServiceAccount = typeof mcpServiceAccount.$inferSelect
export type NewMcpServiceAccount = typeof mcpServiceAccount.$inferInsert

export type McpServiceAccountSecret = typeof mcpServiceAccountSecret.$inferSelect
export type NewMcpServiceAccountSecret = typeof mcpServiceAccountSecret.$inferInsert

export type McpPolicyBinding = typeof mcpPolicyBinding.$inferSelect
export type NewMcpPolicyBinding = typeof mcpPolicyBinding.$inferInsert

export type McpAuditEvent = typeof mcpAuditEvent.$inferSelect
export type NewMcpAuditEvent = typeof mcpAuditEvent.$inferInsert
