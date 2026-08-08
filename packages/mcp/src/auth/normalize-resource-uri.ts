export function normalizeResourceUri(uri: string): string {
  try {
    const url = new URL(uri)
    url.hash = ''
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${pathname}`
  } catch {
    return uri.replace(/\/+$/, '')
  }
}
