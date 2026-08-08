import { trackPageView } from '@durabull/analytics/browser'
import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

/**
 * Tracks SPA page views on route changes via PostHog.
 *
 * Listens to TanStack Router location changes and fires a `$pageview` event
 * each time the pathname changes. Skips duplicate consecutive paths (e.g. hash
 * or search-only changes don't re-fire).
 *
 * Call once in the root layout component.
 */
export function usePageViewTracking() {
  const location = useLocation()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname

    if (currentPath !== previousPath.current) {
      trackPageView(window.location.href, {
        path: currentPath,
        search: location.search ? JSON.stringify(location.search) : undefined,
      })
      previousPath.current = currentPath
    }
  }, [location.pathname, location.search])
}
