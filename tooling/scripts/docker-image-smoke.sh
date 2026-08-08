#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-durabull-smoke}"
COMPOSE_FILE="${COMPOSE_FILE:-tooling/docker/docker-compose.self-hosted.yaml}"
APP_PORT="${DURABULL_APP_PORT:-38080}"
REDIS_PORT="${DURABULL_REDIS_PORT:-36379}"
IMAGE_TAG="${DURABULL_IMAGE:-ghcr.io/durabullhq/durabull:latest}"
MCP_TMP_DIR="$(mktemp -d)"

export DURABULL_IMAGE="$IMAGE_TAG"
export DURABULL_APP_PORT="$APP_PORT"
export DURABULL_REDIS_PORT="$REDIS_PORT"
export APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:${APP_PORT}}"
export VITE_PUBLIC_APP_URL="${VITE_PUBLIC_APP_URL:-http://127.0.0.1:${APP_PORT}}"
export DURABULL_AUTHLESS="${DURABULL_AUTHLESS:-true}"
export MCP_AUTHLESS_BEARER_TOKEN="${MCP_AUTHLESS_BEARER_TOKEN:-durabull-authless-mcp-smoke}"
export DURABULL_ENV_CONNECTIONS="${DURABULL_ENV_CONNECTIONS:-true}"
export DURABULL_REDIS_URL_MAIN="${DURABULL_REDIS_URL_MAIN:-redis://redis:6379}"
export DURABULL_REDIS_URL_MAIN_ENVIRONMENT="${DURABULL_REDIS_URL_MAIN_ENVIRONMENT:-development}"
export DURABULL_REDIS_URL_DEFAULT="${DURABULL_REDIS_URL_DEFAULT:-MAIN}"
export DURABULL_REDIS_URL_ENCRYPTION_KEY="${DURABULL_REDIS_URL_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-durabull-docker-smoke-test-secret-do-not-use-in-production}"

compose() {
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" "$@"
}

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    compose logs --no-color || true
  fi
  compose down -v --remove-orphans || true
  rm -rf "$MCP_TMP_DIR"
  return $exit_code
}

trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local max_attempts="${2:-60}"

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    if curl --silent --show-error --fail "$url" >/dev/null; then
      return 0
    fi
    sleep 2
  done

  echo "Timed out waiting for $url" >&2
  return 1
}

assert_json_contains() {
  local url="$1"
  local expected="$2"
  local body

  body="$(curl --silent --show-error --fail "$url")"
  echo "$body"

  if [[ "$body" != *"$expected"* ]]; then
    echo "Expected response from $url to contain: $expected" >&2
    return 1
  fi
}

echo "Starting smoke stack with image: $DURABULL_IMAGE"
compose up -d

wait_for_url "${APP_BASE_URL}/api/health"

assert_json_contains "${APP_BASE_URL}/api/health" '"status":"ok"'
assert_json_contains "${APP_BASE_URL}/api/app/config" '"authless":true'
assert_json_contains "${APP_BASE_URL}/api/app/config" '"persistence":"pglite"'
if [[ -n "${DURABULL_EXPECTED_BUILD_ID:-}" ]]; then
  assert_json_contains "${APP_BASE_URL}/api/app/version" "\"buildId\":\"${DURABULL_EXPECTED_BUILD_ID}\""
fi
if [[ -n "${DURABULL_EXPECTED_RELEASE_CHANNEL:-}" ]]; then
  assert_json_contains \
    "${APP_BASE_URL}/api/app/version" \
    "\"releaseChannel\":\"${DURABULL_EXPECTED_RELEASE_CHANNEL}\""
fi
initialize_payload='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"durabull-image-smoke","version":"1.0.0"}}}'
initialize_headers="$MCP_TMP_DIR/initialize.headers"
initialize_body="$MCP_TMP_DIR/initialize.body"
curl --silent --show-error --fail \
  --dump-header "$initialize_headers" \
  --output "$initialize_body" \
  --header "Authorization: Bearer ${MCP_AUTHLESS_BEARER_TOKEN}" \
  --header "Origin: ${APP_BASE_URL}" \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Content-Type: application/json' \
  --data "$initialize_payload" \
  "${APP_BASE_URL}/mcp"
grep -F '"serverInfo"' "$initialize_body" >/dev/null

mcp_session_id="$(awk '
  BEGIN { IGNORECASE=1 }
  /^mcp-session-id:/ {
    gsub(/\r/, "", $2)
    print $2
  }
' "$initialize_headers" | tail -n 1)"
if [[ -z "$mcp_session_id" ]]; then
  echo "MCP initialize returned no session ID" >&2
  exit 1
fi

tools_body="$MCP_TMP_DIR/tools.body"
tools_json="$MCP_TMP_DIR/tools.json"
curl --silent --show-error --fail \
  --output "$tools_body" \
  --header "Authorization: Bearer ${MCP_AUTHLESS_BEARER_TOKEN}" \
  --header "Origin: ${APP_BASE_URL}" \
  --header "Mcp-Session-Id: ${mcp_session_id}" \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  "${APP_BASE_URL}/mcp"
sed -n 's/^data: //p' "$tools_body" | tail -n 1 > "$tools_json"
if ! jq -e '
  (.result.tools | length) == 13 and
  all(.result.tools[] | select(.name != "resolve_alert_event");
    .annotations == {
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    }
  ) and
  (.result.tools[] | select(.name == "resolve_alert_event") | .annotations) == {
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
' "$tools_json" >/dev/null; then
  echo "MCP tools/list annotation assertion failed:" >&2
  cat "$tools_body" >&2
  exit 1
fi

connections_body="$MCP_TMP_DIR/connections.body"
connections_json="$MCP_TMP_DIR/connections.json"
curl --silent --show-error --fail \
  --output "$connections_body" \
  --header "Authorization: Bearer ${MCP_AUTHLESS_BEARER_TOKEN}" \
  --header "Origin: ${APP_BASE_URL}" \
  --header "Mcp-Session-Id: ${mcp_session_id}" \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_connections","arguments":{"pageSize":10}}}' \
  "${APP_BASE_URL}/mcp"
sed -n 's/^data: //p' "$connections_body" | tail -n 1 > "$connections_json"
if ! jq -e '
  .result.isError != true and
  (.result.content[0].text | fromjson | .connections | length) == 1
' "$connections_json" >/dev/null; then
  echo "MCP list_connections assertion failed:" >&2
  cat "$connections_body" >&2
  exit 1
fi

echo "Docker image health, build metadata, 13 MCP tool annotations, and MCP domain call passed."

# Keep this after the MCP checks so the smoke proves a fresh MCP request can
# bootstrap authless persistence without relying on an earlier web/API session.
assert_json_contains "${APP_BASE_URL}/api/auth/get-session" '"id":"authless-user"'
