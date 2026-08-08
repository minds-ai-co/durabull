# MCP Phase 1 — GA documentation index

**Phase 1** = read-only hosted MCP at `{APP_BASE_URL}/mcp` (no write/destructive tools).  
**GA** = approved to announce to customers after operator gates in the release checklist (not the same as “merged to `main`”).

## Reading order

| Order | Document | Audience |
| --- | --- | --- |
| 1 | [ADR-0001](./adr/0001-mcp-security-architecture.md) | Engineering, security |
| 2 | [Compliance checklist](./mcp-ga-compliance-checklist.md) | Engineering, release manager |
| 3 | [Security closure](./mcp-ga-security-closure.md) | Security, engineering |
| 4 | [Validation evidence](./mcp-ga-validation-evidence.md) | Engineering, CI |
| 5 | [Release checklist](./mcp-ga-release-checklist.md) | Operators, release manager |
| 6 | [Operations runbook](./mcp-operations-runbook.md) | Operators (day 2) |
| 7 | [OAuth operator guide](./mcp-oauth-operator.md) | Operators, integrators |

User-facing tool/scopes table: [MCP Server](../apps/docs/content/documentation/integrations/mcp-server.mdx).

## Quick links

- **Ship gates:** [Release checklist — Pre-release](./mcp-ga-release-checklist.md#pre-release)
- **Test commands:** [Validation evidence](./mcp-ga-validation-evidence.md)
- **Auth matrix (automated):** [Security closure — Negative test coverage](./mcp-ga-security-closure.md#negative-test-coverage-automated)
