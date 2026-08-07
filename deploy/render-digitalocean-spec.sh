#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <template.json> <output.json>" >&2
  exit 2
fi

template=$1
output=$2

required=(
  CLOUDFLARE_TUNNEL_TOKEN
  DURABULL_MCP_AUTHLESS_BEARER
  DURABULL_REDIS_URL_ENCRYPTION_KEY
  DURABULL_SECRET_ENCRYPTION_KEY
  DURABULL_PRODUCTION_REDIS_URL
  DURABULL_STAGING_REDIS_URL
)

missing=()
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "missing required deployment values: ${missing[*]}" >&2
  exit 1
fi

jq \
  --arg tunnelToken "$CLOUDFLARE_TUNNEL_TOKEN" \
  --arg mcpBearer "$DURABULL_MCP_AUTHLESS_BEARER" \
  --arg redisEncryptionKey "$DURABULL_REDIS_URL_ENCRYPTION_KEY" \
  --arg secretEncryptionKey "$DURABULL_SECRET_ENCRYPTION_KEY" \
  --arg productionRedisUrl "$DURABULL_PRODUCTION_REDIS_URL" \
  --arg stagingRedisUrl "$DURABULL_STAGING_REDIS_URL" \
  '
    def setenv($key; $value):
      (.services[] | select(.name == "durabull").envs[] | select(.key == $key).value) = $value;

    setenv("MCP_AUTHLESS_BEARER_TOKEN"; $mcpBearer) |
    setenv("DURABULL_REDIS_URL_ENCRYPTION_KEY"; $redisEncryptionKey) |
    setenv("DURABULL_SECRET_ENCRYPTION_KEY"; $secretEncryptionKey) |
    setenv("DURABULL_REDIS_URL_PRODUCTION"; $productionRedisUrl) |
    setenv("DURABULL_REDIS_URL_STAGING"; $stagingRedisUrl) |
    (.workers[] | select(.name == "cloudflared").envs[] | select(.key == "TUNNEL_TOKEN").value) = $tunnelToken
  ' "$template" > "$output"

chmod 600 "$output"

if rg -q '__[A-Z0-9_]+__' "$output"; then
  echo "rendered spec contains unresolved placeholders" >&2
  exit 1
fi

jq -e . "$output" >/dev/null
