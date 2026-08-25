#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
rendered=$(mktemp)
trap 'rm -f "$rendered"' EXIT

export CLOUDFLARE_TUNNEL_TOKEN=test-tunnel-token
export DURABULL_MCP_AUTHLESS_BEARER=test-mcp-bearer-00000000000000000000000000000000
export DURABULL_REDIS_URL_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
export DURABULL_SECRET_ENCRYPTION_KEY=1111111111111111111111111111111111111111111111111111111111111111
export DURABULL_PRODUCTION_REDIS_URL='rediss://user:password@production.example.invalid:25061'
export DURABULL_STAGING_REDIS_URL='rediss://user:password@staging.example.invalid:25061'
export DURABULL_IMAGE_TAG=0123456789abcdef0123456789abcdef01234567

"$repo_root/deploy/render-digitalocean-spec.sh" \
  "$repo_root/deploy/digitalocean-app.template.json" \
  "$rendered"

jq -e '
  .name == "minds-durabull-internal" and
  (.domains | not) and
  (.ingress | not) and
  ([.services[] | select(.name == "durabull")] | length) == 1 and
  ([.workers[] | select(.name == "cloudflared")] | length) == 1 and
  (.services[] | select(.name == "durabull") | (.http_port | not)) and
  (.services[] | select(.name == "durabull") | .internal_ports == [3000]) and
  (.workers[] | select(.name == "cloudflared") | (.http_port | not)) and
  (.workers[] | select(.name == "cloudflared") | .run_command == "cloudflared tunnel --protocol http2 --no-autoupdate run") and

  # A single replica of either component is a hostname-wide outage: cloudflared
  # proxies to http://durabull:3000, so one restarting durabull container means
  # zero origins and Cloudflare answers 502, and one restarting connector means
  # the tunnel has nobody registered at all. Two of each is what makes a normal
  # restart invisible from the edge — do not lower these to save a few euros.
  (.services[] | select(.name == "durabull") | .instance_count >= 2) and
  (.workers[] | select(.name == "cloudflared") | .instance_count >= 2) and

  # Boot to serving is ~17s (container start -> "Database migrations applied").
  # A 45s initial delay held a restarted replica out of rotation for over twice
  # as long as it needed, which is pure added outage while count was 1.
  (.services[] | select(.name == "durabull") | .health_check.initial_delay_seconds <= 20) and

  # The 25 Aug 2026 restart was invisible: no alert fired and the pre-restart
  # logs were gone by the time anyone looked. These make the next one legible.
  ([.services[] | select(.name == "durabull") | .alerts[] | select(.rule == "RESTART_COUNT")] | length) == 1 and
  ([.services[] | select(.name == "durabull") | .alerts[] | select(.rule == "MEM_UTILIZATION")] | length) == 1 and
  ([.workers[] | select(.name == "cloudflared") | .alerts[] | select(.rule == "RESTART_COUNT")] | length) == 1 and
  (.services[] | select(.name == "durabull") | .image == {
    "registry_type": "DOCR",
    "registry": "training",
    "repository": "durabull",
    "tag": "0123456789abcdef0123456789abcdef01234567"
  }) and
  (.workers[] | select(.name == "cloudflared") | .image.tag == "2026.7.2") and
  ([.services[].envs[] | select(.key == "DURABULL_REDIS_URL_PRODUCTION")] | length) == 1 and
  ([.services[].envs[] | select(.key == "DURABULL_REDIS_URL_STAGING")] | length) == 1 and
  ((.services[] | select(.name == "durabull") | .envs[] | select(.key == "DURABULL_PROCESSOR_COMPONENTS") | .value | fromjson) as $components |
    ($components | map(.name)) == ["processor-build-p1", "processor-build-p2", "processor-interactive", "processor-background"] and
    ($components | map(.processors[]) | length) == 38 and
    ($components | map(.processors[]) | unique | length) == 38) and
  ([.services[].envs[] | select(.key == "BETTER_AUTH_SECRET")] | length) == 0
' "$rendered" >/dev/null

echo "standalone DigitalOcean spec: ok"
