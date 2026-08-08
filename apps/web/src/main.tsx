import { configureDurabullTelemetry } from '@durabull/analytics/browser'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_BUILD_INFO } from './lib/app-version'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()
const runtime =
  typeof navigator !== 'undefined' && /\belectron\b/i.test(navigator.userAgent) ? 'electron' : 'web'

configureDurabullTelemetry({
  enabled: false,
  collectionRequired: true,
  runtimeContext: {
    app_version: APP_BUILD_INFO.version,
    app_build_id: APP_BUILD_INFO.buildId,
    runtime,
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
