/**
 * Redis key-related hooks using Hono RPC client
 * Types are inferred from the server via InferResponseType
 */

import { trackEvent } from '@durabull/analytics/browser'
import { AnalyticsEvents } from '@durabull/analytics/events'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConnection } from '@/components/connection-provider'
import { ApiError, api, handleRes, type InferResponseType } from '@/lib/api'
import { PAGINATION, STALE_TIME } from '@/lib/constants'

// Re-export ApiError for backward compatibility
export { ApiError }

// Type aliases for cleaner type inference
type RedisKeysEndpoint = (typeof api.c)[':connectionId']['redis-keys']
type SearchEndpoint = RedisKeysEndpoint['search']
type ValueEndpoint = RedisKeysEndpoint['value'][':key']

// Type helpers using Hono's InferResponseType
type SearchKeysResponse = InferResponseType<SearchEndpoint['$get'], 200>
type GetKeyValueResponse = InferResponseType<ValueEndpoint['$get'], 200>

// Re-export response types for consumers
export type { SearchKeysResponse, GetKeyValueResponse }

/**
 * Query key factory for Redis key queries
 */
export const redisKeyQueryKeys = {
  search: (connectionId: string, pattern: string, excludeBull = false) =>
    ['redis-keys', 'search', connectionId, pattern, { excludeBull }] as const,
  value: (connectionId: string, key: string) => ['redis-keys', 'value', connectionId, key] as const,
}

// Search options
interface RedisKeySearchOptions {
  excludeBull?: boolean
  enabled?: boolean
}

// Search Redis keys with infinite scrolling
export function useRedisKeySearch(pattern: string, options: RedisKeySearchOptions = {}) {
  const { excludeBull = false, enabled = true } = options
  const { currentConnection } = useConnection()
  const connectionId = currentConnection?.id

  return useInfiniteQuery({
    queryKey: redisKeyQueryKeys.search(connectionId ?? '', pattern, excludeBull),
    queryFn: async ({ pageParam = '0' }) => {
      const res = await api.c[':connectionId']['redis-keys'].search.$get({
        param: { connectionId: connectionId! },
        query: {
          pattern: pattern || '*',
          cursor: pageParam,
          pageSize: String(PAGINATION.REDIS_KEYS_PAGE_SIZE),
          excludeBull: excludeBull ? 'true' : undefined,
        },
      })
      return handleRes<SearchKeysResponse>(res)
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    initialPageParam: '0',
    enabled: !!connectionId && enabled,
    staleTime: STALE_TIME.REDIS_KEYS,
  })
}

// Get value for a specific key
export function useRedisKeyValue(key: string | null) {
  const { currentConnection } = useConnection()
  const connectionId = currentConnection?.id

  return useQuery({
    queryKey: redisKeyQueryKeys.value(connectionId ?? '', key ?? ''),
    queryFn: async () => {
      const res = await api.c[':connectionId']['redis-keys'].value[':key'].$get({
        param: { connectionId: connectionId!, key: encodeURIComponent(key!) },
        query: {}, // Required by zValidator even though all params have defaults
      })
      return handleRes<GetKeyValueResponse>(res)
    },
    enabled: !!connectionId && !!key,
    staleTime: STALE_TIME.FREQUENT,
  })
}

// Delete a Redis key
export function useDeleteRedisKey() {
  const queryClient = useQueryClient()
  const { currentConnection } = useConnection()
  const connectionId = currentConnection?.id

  return useMutation({
    mutationFn: async (key: string) => {
      const res = await api.c[':connectionId']['redis-keys'][':key'].$delete({
        param: { connectionId: connectionId!, key: encodeURIComponent(key) },
      })
      return handleRes<{ success: boolean; deleted: string }>(res)
    },
    onSuccess: (_, key) => {
      trackEvent(AnalyticsEvents.REDIS_KEY_DELETED, {
        redis_key: key,
        success: true,
      })
      queryClient.invalidateQueries({
        queryKey: ['redis-keys', 'search', connectionId],
      })
    },
    onError: (_, key) => {
      trackEvent(AnalyticsEvents.REDIS_KEY_DELETED, {
        redis_key: key,
        success: false,
      })
    },
  })
}
