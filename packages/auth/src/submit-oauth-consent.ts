import { isSafeOAuthRedirectUri } from './safe-redirect'

export interface SubmitOAuthConsentInput {
  accept: boolean
  consentCode?: string | null
}

export interface SubmitOAuthConsentResult {
  redirectURI: string
}

/**
 * Complete the Better Auth MCP / OIDC consent step after the user allows or denies access.
 */
export async function submitOAuthConsent(
  input: SubmitOAuthConsentInput
): Promise<SubmitOAuthConsentResult> {
  if (typeof window === 'undefined') {
    throw new Error('submitOAuthConsent must run in the browser')
  }

  const base = `${window.location.origin}/api/auth`

  const response = await fetch(`${base}/oauth2/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      accept: input.accept,
      ...(input.consentCode ? { consent_code: input.consentCode } : {}),
    }),
  })

  if (!response.ok) {
    let detail = `Consent request failed (${response.status})`
    try {
      const body = (await response.json()) as { message?: string; error_description?: string }
      detail = body.error_description ?? body.message ?? detail
    } catch {
      // ignore parse errors
    }
    throw new Error(detail)
  }

  const data = (await response.json()) as SubmitOAuthConsentResult
  if (!data.redirectURI) {
    throw new Error('Consent response did not include a redirect URI')
  }

  if (!isSafeOAuthRedirectUri(data.redirectURI)) {
    throw new Error('Consent redirect URI is not allowed')
  }

  return data
}
