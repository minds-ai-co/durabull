import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const rootPackage = require('../../package.json') as { version?: string }

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }

  return ''
}

const appVersion = firstNonEmpty(process.env.DURABULL_APP_VERSION, rootPackage.version) || '0.0.0'
const appBuildId =
  firstNonEmpty(
    process.env.DURABULL_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA
  ) || appVersion
const appBuildTime = firstNonEmpty(process.env.DURABULL_BUILD_TIME)

/**
 * Pure SPA Vite Configuration
 *
 * Development:
 *   - `bun dev` runs both API (port 3001) and Vite dev server (port 5173)
 *   - Proxy forwards /api/* and /ingest/* to appropriate targets
 *
 * Production:
 *   - `bun run build` outputs static files to dist/
 *   - API server serves these static files on port 3000
 */
export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  define: {
    __DURABULL_APP_VERSION__: JSON.stringify(appVersion),
    __DURABULL_BUILD_ID__: JSON.stringify(appBuildId),
    __DURABULL_BUILD_TIME__: JSON.stringify(appBuildTime || null),
  },
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      // API requests to the API server
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // MCP + OAuth discovery (same origin as APP_BASE_URL in local dev)
      '/mcp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // PostHog proxy traffic always goes through the API server.
      '/ingest': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    viteReact(),
  ],
})
