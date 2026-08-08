import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents, AuthMethod } from '@durabull/analytics/events'
import {
  buildMcpAuthorizeResumeUrl,
  hasMcpAuthorizeQuery,
  isSafeAppRedirectPath,
  resolveSafeAppRedirectPath,
} from '@durabull/auth/client'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, Github, Loader2, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AuthLayout } from '@/components/auth-layout'
import { DurabullLogo, DurabullWordmark } from '@/components/durabull-logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getAuthErrorMessage, useAuth } from '@/hooks/use-auth'

interface LoginSearch {
  invitationId?: string
  redirect?: string
}

function parseLoginSearch(search: Record<string, unknown>): LoginSearch {
  const redirectRaw =
    typeof search.redirect === 'string' &&
    search.redirect.length > 0 &&
    isSafeAppRedirectPath(search.redirect)
      ? search.redirect
      : undefined

  return {
    invitationId:
      typeof search.invitationId === 'string' && search.invitationId.length > 0
        ? search.invitationId
        : undefined,
    redirect: redirectRaw,
  }
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => parseLoginSearch(search),
  component: LoginPage,
})

function LoginPage() {
  const { invitationId, redirect } = Route.useSearch()
  const navigate = useNavigate()
  const { signIn, isAuthenticated, isLoading: sessionLoading, refetch } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const invitationPath = invitationId ? `/invite/${invitationId}` : null

  const getPostAuthCallbackURL = (): string | undefined => {
    if (typeof window === 'undefined') {
      return undefined
    }

    if (redirect) {
      return `${window.location.origin}${redirect}`
    }

    const urlParams = Object.fromEntries(new URLSearchParams(window.location.search).entries())
    const mcpAuthorizeUrl = buildMcpAuthorizeResumeUrl(urlParams)
    if (mcpAuthorizeUrl) {
      return `${window.location.origin}${mcpAuthorizeUrl}`
    }

    if (invitationPath) {
      return `${window.location.origin}${invitationPath}`
    }

    return undefined
  }

  const navigateAfterAuth = () => {
    if (typeof window === 'undefined') {
      return
    }

    const safeRedirect = redirect
      ? resolveSafeAppRedirectPath(redirect, window.location.origin)
      : undefined
    if (safeRedirect) {
      window.location.assign(safeRedirect)
      return
    }

    const urlParams =
      typeof window !== 'undefined'
        ? Object.fromEntries(new URLSearchParams(window.location.search).entries())
        : {}
    const mcpAuthorizeUrl = buildMcpAuthorizeResumeUrl(urlParams)
    if (mcpAuthorizeUrl) {
      window.location.assign(mcpAuthorizeUrl)
      return
    }

    if (invitationId) {
      navigate({ to: '/invite/$invitationId', params: { invitationId } })
      return
    }
    navigate({ to: '/' })
  }

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      navigateAfterAuth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once when session becomes authenticated
  }, [isAuthenticated, sessionLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn.email({
        email: formData.email,
        password: formData.password,
      })

      if (result.error) {
        trackEvent(AnalyticsEvents.USER_SIGNED_IN, {
          auth_method: AuthMethod.EMAIL,
          success: false,
        })
        setError(getAuthErrorMessage(result, 'Invalid email or password'))
        setIsLoading(false)
        return
      }

      trackEvent(AnalyticsEvents.USER_SIGNED_IN, {
        auth_method: AuthMethod.EMAIL,
        success: true,
      })

      await refetch()
      navigateAfterAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.')
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    trackEvent(AnalyticsEvents.USER_SIGNED_IN, {
      auth_method: AuthMethod.GOOGLE,
      success: true,
    })

    const callbackURL = getPostAuthCallbackURL()
    const authorizeParams =
      typeof window !== 'undefined'
        ? Object.fromEntries(new URLSearchParams(window.location.search).entries())
        : {}
    const preserveMcpAuthorize = hasMcpAuthorizeQuery(authorizeParams)

    try {
      const result = await signIn.social({
        provider: 'google',
        ...(callbackURL
          ? {
              callbackURL,
              newUserCallbackURL: callbackURL,
            }
          : {}),
        ...(invitationId || preserveMcpAuthorize
          ? {
              requestSignUp: true,
            }
          : {}),
      })

      if (result?.error) {
        const errorMessage = getAuthErrorMessage(result, 'Failed to sign in with Google')

        if (errorMessage === 'ACCOUNT_EXISTS') {
          navigate({ to: '/auth-error', search: { reason: 'account-exists', provider: 'google' } })
          return
        }

        setError(errorMessage)
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    setError(null)

    trackEvent(AnalyticsEvents.USER_SIGNED_IN, {
      auth_method: AuthMethod.GITHUB,
      success: true,
    })

    const callbackURL = getPostAuthCallbackURL()

    const authorizeParams =
      typeof window !== 'undefined'
        ? Object.fromEntries(new URLSearchParams(window.location.search).entries())
        : {}
    const preserveMcpAuthorize = hasMcpAuthorizeQuery(authorizeParams)

    try {
      const result = await signIn.social({
        provider: 'github',
        ...(callbackURL
          ? {
              callbackURL,
              newUserCallbackURL: callbackURL,
            }
          : {}),
        ...(invitationId || preserveMcpAuthorize
          ? {
              requestSignUp: true,
            }
          : {}),
      })

      if (result?.error) {
        const errorMessage = getAuthErrorMessage(result, 'Failed to sign in with GitHub')

        if (errorMessage === 'ACCOUNT_EXISTS') {
          navigate({ to: '/auth-error', search: { reason: 'account-exists', provider: 'github' } })
          return
        }

        setError(errorMessage)
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with GitHub')
      setIsLoading(false)
    }
  }

  if (sessionLoading || isAuthenticated) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex min-h-screen items-center justify-center p-4 pt-24">
        <Card className="w-full max-w-md border-border bg-card p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <DurabullLogo className="h-10 w-10 text-primary" />
              <DurabullWordmark className="h-6" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGitHubSignIn}
              disabled={isLoading}
            >
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            {invitationId ? (
              <Link
                to="/signup"
                search={{ invitationId }}
                className="font-medium text-foreground hover:text-foreground/80 underline underline-offset-4"
              >
                Sign up
              </Link>
            ) : (
              <Link
                to="/signup"
                className="font-medium text-foreground hover:text-foreground/80 underline underline-offset-4"
              >
                Sign up
              </Link>
            )}
          </p>
        </Card>
      </div>
    </AuthLayout>
  )
}
