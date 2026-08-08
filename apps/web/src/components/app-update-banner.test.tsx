import { AnalyticsEvents } from '@durabull/analytics/events'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateBanner } from './app-update-banner'

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  useAppVersionCheck: vi.fn(),
}))

vi.mock('@durabull/analytics/browser', () => ({
  trackEvent: mocks.trackEvent,
}))

vi.mock('@/hooks/use-app-version-check', () => ({
  useAppVersionCheck: mocks.useAppVersionCheck,
}))

describe('AppUpdateBanner', () => {
  beforeEach(() => {
    mocks.trackEvent.mockReset()
    mocks.useAppVersionCheck.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays hidden when the current build matches the API build', () => {
    mocks.useAppVersionCheck.mockReturnValue({
      client: { version: '1.4.0', buildId: 'build-a', buildTime: null },
      server: {
        version: '1.4.0',
        buildId: 'build-a',
        buildTime: null,
        releaseChannel: 'stable',
        update: { required: false, reason: 'up_to_date' },
      },
      updateRequired: false,
      updateReason: 'up_to_date',
      isChecking: false,
      error: null,
    })

    render(<AppUpdateBanner />)

    expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument()
  })

  it('tracks the update click and triggers the update action', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    mocks.useAppVersionCheck.mockReturnValue({
      client: { version: '1.3.0', buildId: 'build-a', buildTime: null },
      server: {
        version: '1.4.0',
        buildId: 'build-b',
        buildTime: null,
        releaseChannel: 'stable',
        update: { required: true, reason: 'build_mismatch' },
      },
      updateRequired: true,
      updateReason: 'build_mismatch',
      isChecking: false,
      error: null,
    })

    render(<AppUpdateBanner onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /update/i }))

    expect(mocks.trackEvent).toHaveBeenCalledWith(
      AnalyticsEvents.APP_UPDATE_CLICKED,
      expect.objectContaining({
        app_version: '1.3.0',
        app_build_id: 'build-a',
        server_version: '1.4.0',
        server_build_id: 'build-b',
        update_reason: 'build_mismatch',
        action: 'reload',
      })
    )
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
  })

  it('still triggers the update action if analytics tracking fails', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    mocks.trackEvent.mockImplementation(() => {
      throw new Error('posthog unavailable')
    })
    mocks.useAppVersionCheck.mockReturnValue({
      client: { version: '1.3.0', buildId: 'build-a', buildTime: null },
      server: {
        version: '1.4.0',
        buildId: 'build-b',
        buildTime: null,
        releaseChannel: 'stable',
        update: { required: true, reason: 'build_mismatch' },
      },
      updateRequired: true,
      updateReason: 'build_mismatch',
      isChecking: false,
      error: null,
    })

    render(<AppUpdateBanner onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
  })
})
