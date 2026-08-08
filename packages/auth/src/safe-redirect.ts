/**
 * Validates in-app redirect paths (open redirect hardening).
 */
export function isSafeAppRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) {
    return false
  }
  if (path.startsWith('//') || path.startsWith('/\\')) {
    return false
  }
  if (path.includes(':')) {
    return false
  }
  return true
}

export function resolveSafeAppRedirectPath(
  path: string | undefined,
  origin: string
): string | undefined {
  if (!path || !isSafeAppRedirectPath(path)) {
    return undefined
  }
  try {
    const url = new URL(path, origin)
    if (url.origin !== origin) {
      return undefined
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}

/**
 * OAuth redirect URIs from Better Auth must be absolute http(s) URLs.
 */
export function isSafeOAuthRedirectUri(redirectUri: string, allowedOrigins?: string[]): boolean {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  if (allowedOrigins?.length) {
    return allowedOrigins.some((origin) => {
      try {
        return new URL(origin).origin === url.origin
      } catch {
        return false
      }
    })
  }
  return true
}
