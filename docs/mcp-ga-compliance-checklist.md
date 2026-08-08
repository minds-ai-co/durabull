# MCP Phase 1 — Spec Compliance Checklist

**GA target:** Read-only hosted MCP at `{APP_BASE_URL}/mcp`  
**Verified on branch:** `feat/no-linear-mcp-pr08-ga-readiness` (2026-05-28)  
**Stack:** PR-02 through PR-07 merged on `main`; PR-08 closes GA.  
**Index:** [mcp-ga-index.md](./mcp-ga-index.md)

## Transport (Streamable HTTP)

| Requirement | Status | Evidence |
| --- | --- | --- |
| `GET` / `POST` / `DELETE` on `/mcp` | Done | [validation evidence](./mcp-ga-validation-evidence.md) |
| MCP `initialize` + session handling | Done | `apps/api/src/mcp/mount.test.ts` |
| Host header validation | Done | `packages/mcp` allowed-hosts tests + `mount.test.ts` |
| `/mcp` not captured by SPA static fallback | Done | `apps/api/src/mcp/mount.test.ts` |
| Request size limits (API app) | Done | `packages/mcp/src/routes.ts` — 1MB body limit |

## OAuth discovery and bearer auth

Auth negative scenarios: [security closure — Negative test coverage](./mcp-ga-security-closure.md#negative-test-coverage-automated).

| Requirement | Status | Evidence |
| --- | --- | --- |
| Protected Resource Metadata (PRM) | Done | `apps/api/src/mcp/mount.test.ts` |
| `WWW-Authenticate` on missing bearer | Done | `packages/mcp` bearer-middleware tests |
| Bearer required on all `/mcp` methods | Done | `packages/mcp/src/routes.test.ts` |
| Canonical resource `{APP_BASE_URL}/mcp` | Done | `resource-uri.test.ts` |
| Wrong resource → 401 | Done | `validate-token.test.ts` |
| Missing scope → 403 | Done | `mount.test.ts` |
| Expired token → 401 | Done | `session.test.ts`, `mount.test.ts` |

## Authorization and tenancy

| Requirement | Status | Evidence |
| --- | --- | --- |
| Per-tool scope mapping | Done | `apps/api/src/mcp/policy/policy-engine.ts` |
| Delegated user connection boundary | Done | `apps/api/src/mcp/mount.test.ts` |
| Service account policy bindings | Done | `packages/dal` mcp-policy tests |
| Fail closed on unmapped tools | Done | `apps/api/src/mcp/policy/policy-engine.test.ts` |
| Best-effort audit on tool calls | Done | `apps/api/src/mcp/audit/mcp-audit.test.ts`; may drop under backpressure (`audit_dropped`) |

## Read-only tool catalog

Tool names and scopes: [ADR-0001 §3](./adr/0001-mcp-security-architecture.md) and [MCP Server user doc](../apps/docs/content/documentation/integrations/mcp-server.mdx).

| Check | Status |
| --- | --- |
| 11 read tools + `ping` registered | Done |
| `explain_job_failure` requires `mcp:diagnostics:read`, `mcp:jobs:read`, `mcp:logs:read`, `mcp:failures:read` | Done |
| No write/destructive tools | Done |

## Safety (PR-06)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Output sanitization | Done | `sanitize-output.test.ts` |
| Per-tool rate limits | Done | `mcp-tool-rate-limit.test.ts` |
| Audit `input_hash` + `response_class` | Done | `mcp-audit.test.ts` |
| `mcp_telemetry` signals | Done | `mount.test.ts` |

## Deployment and operations (PR-07)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Unified `/mcp` cloud docs | Done | `deployment/render-and-demo.mdx` |
| Self-host single-port docs | Done | `deployment/docker.mdx` |
| Operator runbook | Done | `mcp-operations-runbook.md` |

## Staging / live validation (operator)

Operator gates: [release checklist — Pre-release](./mcp-ga-release-checklist.md#pre-release).

## Known non-blocking follow-ups

| Item | Tracking |
| --- | --- |
| Redis-backed rate limits for multi-replica | Phase 2 |
| `packages/mcp-domain` extraction | Master plan §2.2 |
| Pre-existing `alerts-global.test.ts` typecheck | Blocks full `@durabull/api` typecheck |
| Staging soak / validated SLOs | Post-GA; see release checklist draft SLOs |

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Engineering | | | See [validation evidence](./mcp-ga-validation-evidence.md) |
| Security | | | See [security closure](./mcp-ga-security-closure.md) — human sign-off recommended before production announcement |
