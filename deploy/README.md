# Minds internal deployment

This deployment keeps Durabull independent from the Minds webapp. One
DigitalOcean app contains:

- the Durabull service on internal port `3000`, with no public ingress;
- a `cloudflared` worker that connects the service to a remotely managed
  Cloudflare Tunnel;
- both Minds Valkey connections, labelled `Production` and `Staging` in the
  Durabull UI.

The canonical URL is `https://durabull.getminds.ai`. Cloudflare Access remains
the user-facing authentication boundary. Durabull runs in authless mode behind
that boundary, so internal users do not need to create a second Durabull
account. MCP uses its own bearer token in addition to Cloudflare Access.

## Deployment boundary

The workflow in `.github/workflows/deploy-minds-internal.yml` is
`workflow_dispatch` only. Merging this repository does not deploy the app.
Deployment must be started manually by an authorized owner after the production
environment secrets are present.

The Cloudflare Tunnel must be remotely configured with:

1. Published hostname: `durabull.getminds.ai`
2. Service: `http://durabull:3000`
3. Catch-all rule: `http_status:404`

Do not change DNS to the tunnel until the standalone DigitalOcean deployment is
healthy. After cutover is verified, the old Durabull components can be removed
from the webapp app specifications.

## Required production environment secrets

- `DIGITALOCEAN_ACCESS_TOKEN`
- `CLOUDFLARE_TUNNEL_TOKEN`
- `DURABULL_MCP_AUTHLESS_BEARER`
- `DURABULL_REDIS_URL_ENCRYPTION_KEY`
- `DURABULL_SECRET_ENCRYPTION_KEY`
- `DURABULL_PRODUCTION_REDIS_URL`
- `DURABULL_STAGING_REDIS_URL`

The rendered spec contains secret material and must never be committed.

## Local validation

```bash
deploy/check-digitalocean-spec.sh
```

The check renders the template with non-secret test values and verifies that no
public DigitalOcean route can reach Durabull.
