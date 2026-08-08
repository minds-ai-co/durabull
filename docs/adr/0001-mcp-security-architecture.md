# ADR-0001: MCP Security Architecture (Phase 1)

**Status:** Accepted  
**Date:** 2026-05-28  
**Supersedes:** N/A (initial ADR; deployable placement amended from early drafts that referenced standalone `apps/mcp`)

## Context

Durabull exposes a hosted, remote MCP server so AI clients can perform **read-only** queue diagnostics (jobs, failures, logs, metrics) without direct Redis access. Remote MCP transport requires OAuth 2.1 bearer tokens, tenant isolation, and output safety because tool responses may contain customer job payloads and logs.

## Decision

### 1. Deployable placement (phase 1)

MCP runs on the **same origin, same process, and same public port** as the unified Durabull API + web app.

| Path | Handler |
| --- | --- |
| `/mcp` | Streamable HTTP MCP (`packages/mcp` + thin `apps/api/src/mcp/` mount) |
| `/api/*` | REST/RPC API |
| `/.well-known/oauth-protected-resource` | PRM fallback on app origin |

Canonical resource URI: `{APP_BASE_URL}/mcp` (no trailing slash unless client libraries require consistency everywhere).

**Not in phase 1:** standalone `apps/mcp` deployable, second public MCP port (`3020`), dual-process Docker supervisors.

### 2. Module boundaries

- **Transport, bearer validation helpers, sanitization:** `packages/mcp`
- **Ingress mount, policy, tool handlers, audit:** `apps/api/src/mcp/`
- **Persistence:** `packages/dal` (`mcp_service_account*`, `mcp_policy_binding`, `mcp_audit_event`, `oauth_*`)
- **Identity:** Better Auth MCP plugin + Durabull scope middleware

MCP route handlers must not embed BullMQ/domain logic; they call shared API lib handlers with typed DTOs.

### 3. Phase 1 capability surface

- **Read-only tools only** — no retries, removes, pauses, purges, or arbitrary Redis access.
- **Tools:** `ping`, `list_connections`, `list_queues`, `get_queue`, `list_jobs`, `get_job`, `get_job_logs`, `get_job_stacktraces`, `get_failure_events`, `get_queue_metrics`, `get_workers`, `explain_job_failure`.
- **Write scopes reserved** for phase 2 (`mcp:jobs:retry`, `mcp:queues:pause`, etc.) — not registered in phase 1.

### 4. Authentication

- **Delegated users:** OAuth 2.1 access tokens via Better Auth MCP plugin; RFC 8707 `resource` must match `{APP_BASE_URL}/mcp`.
- **Service accounts:** OAuth-linked machine principals with org-scoped `mcp_policy_binding` rows (scopes alone are insufficient).
- **401** missing/invalid token or wrong resource; **403** insufficient scope or policy deny.
- PRM + `WWW-Authenticate` challenges on unauthenticated `/mcp` requests.

### 5. Authorization (policy engine)

Every `tools/call` passes through `evaluateMcpToolPolicy`:

1. Tool must have explicit scope mapping (fail closed if missing).
2. OAuth scopes must include required scopes for the tool.
3. **Delegated users:** `connectionId` in arguments must belong to user's org membership.
4. **Service accounts:** matching `mcp_policy_binding` for tool + org + optional connection constraint.

Policy decisions are audited to `mcp_audit_event`.

### 6. Scope taxonomy (phase 1)

| Scope | Purpose |
| --- | --- |
| `mcp:discover` | Transport smoke (`ping`) |
| `mcp:jobs:read` | Connections, queues, jobs, workers |
| `mcp:logs:read` | Job logs and stacktraces |
| `mcp:failures:read` | Failure/alert events |
| `mcp:diagnostics:read` | Queue metrics (`get_queue_metrics`); also required for `explain_job_failure` together with `mcp:jobs:read`, `mcp:logs:read`, and `mcp:failures:read` |

### 7. Data safety

- Central `sanitizeMcpOutput` on all read-tool responses.
- Denylist: Redis URLs, credential-like keys, bearer/JWT patterns.
- `_mcpSafety.redactionCount` metadata on responses.

### 8. Operational controls

- Host header allowlist on `/mcp` (includes `APP_BASE_URL` host).
- Ingress + per-tool in-memory rate limits (per-process; shared backend deferred for multi-replica).
- Structured `mcp_telemetry` JSON logs for policy denies, rate limits, tool outcomes.

## Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Token theft / replay | Short-lived OAuth tokens; expiry enforced; TLS required at ingress/platform (not enforced inside MCP handlers) |
| Confused deputy (wrong audience) | RFC 8707 resource binding to `{APP_BASE_URL}/mcp` |
| Scope escalation | Explicit per-tool scope map; 403 with `insufficient_scope` |
| Cross-tenant data access | Org membership + connection checks; service-account bindings |
| Secret leakage via tool output | Central sanitizer + tests |
| Abuse / DoS | Rate limits on ingress and heavy tools |
| Host header attacks | Strict Host allowlist before auth |
| Accidental write actions | No write tools registered in phase 1 |

## Consequences

**Positive**

- Single deployment simplifies TLS, OAuth resource URI, and operator docs.
- Clear security boundary in code despite unified process.
- Read-only GA reduces blast radius.

**Negative / accepted debt**

- In-memory rate limits are not coordinated across replicas until phase 2.
- Domain logic still lives in API handlers rather than `packages/mcp-domain` (optional extraction).
- Full staging `mcp:e2e` requires operator-run credentials (documented in runbook).

## References

- `tasks/mcp-implementation-master-plan.md`
- `docs/mcp-oauth-operator.md`
- `docs/mcp-operations-runbook.md`
- `docs/mcp-ga-index.md`
- `docs/mcp-ga-compliance-checklist.md`
- `docs/mcp-ga-security-closure.md`
- `docs/mcp-ga-release-checklist.md`
