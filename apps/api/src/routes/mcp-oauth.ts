import { authSchema, eq, getDb, oauthApplication } from '@durabull/dal'
import { Hono } from 'hono'
import { requireSession } from '../middleware/auth'

const { authVerification } = authSchema

interface PendingMcpAuthorization {
  clientId: string
  redirectURI: string
  scope: string[]
  userId: string
  requireConsent?: boolean
}

function parsePendingAuthorization(value: string): PendingMcpAuthorization | null {
  try {
    const parsed = JSON.parse(value) as PendingMcpAuthorization
    if (
      typeof parsed.clientId !== 'string' ||
      !Array.isArray(parsed.scope) ||
      typeof parsed.userId !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const app = new Hono()

/**
 * Authoritative consent context for the MCP consent screen (session required).
 * Scopes and client come from the pending authorization stored by Better Auth, not URL params.
 */
app.get('/oauth-consent/:consentCode', requireSession, async (c) => {
  const consentCode = c.req.param('consentCode')
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (!consentCode) {
    return c.json({ error: 'consent_code is required' }, 400)
  }

  const db = await getDb()
  const [verification] = await db
    .select({
      value: authVerification.value,
      expiresAt: authVerification.expiresAt,
    })
    .from(authVerification)
    .where(eq(authVerification.identifier, consentCode))
    .limit(1)

  if (!verification || verification.expiresAt < new Date()) {
    return c.json({ error: 'Consent request not found or expired' }, 404)
  }

  const pending = parsePendingAuthorization(verification.value)
  if (!pending) {
    return c.json({ error: 'Invalid consent request' }, 400)
  }

  if (pending.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const [client] = await db
    .select({
      clientId: oauthApplication.clientId,
      name: oauthApplication.name,
      icon: oauthApplication.icon,
      disabled: oauthApplication.disabled,
    })
    .from(oauthApplication)
    .where(eq(oauthApplication.clientId, pending.clientId))
    .limit(1)

  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }

  if (client.disabled) {
    return c.json(
      {
        error: 'client_disabled',
        message: 'This application has been disabled and cannot be authorized.',
        clientId: client.clientId,
        name: client.name,
        icon: client.icon,
        disabled: true,
        scopes: pending.scope,
      },
      403
    )
  }

  return c.json({
    clientId: client.clientId,
    name: client.name,
    icon: client.icon,
    disabled: client.disabled,
    scopes: pending.scope,
  })
})

/**
 * OAuth client metadata (session required). Prefer oauth-consent for the consent screen.
 */
app.get('/oauth-client/:clientId', requireSession, async (c) => {
  const clientId = c.req.param('clientId')

  const db = await getDb()
  const [client] = await db
    .select({
      clientId: oauthApplication.clientId,
      name: oauthApplication.name,
      icon: oauthApplication.icon,
      disabled: oauthApplication.disabled,
    })
    .from(oauthApplication)
    .where(eq(oauthApplication.clientId, clientId))
    .limit(1)

  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }

  return c.json({
    clientId: client.clientId,
    name: client.name,
    icon: client.icon,
    disabled: client.disabled,
  })
})

export default app
