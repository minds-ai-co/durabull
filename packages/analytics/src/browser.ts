/**
 * Browser / React analytics (PostHog JS SDK).
 *
 * Prefer `@durabull/analytics/browser` in app code.
 */
export {
  configureDurabullTelemetry,
  getPostHog,
  identifyOrganization,
  identifyUser,
  initAnalytics,
  type OrganizationProperties,
  resetIdentity,
  trackEvent,
  trackOrganizationCreated,
  trackPageView,
  trackUserCreated,
  type UserProperties,
} from './client'
