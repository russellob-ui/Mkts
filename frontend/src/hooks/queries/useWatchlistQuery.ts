'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useWatchlistQuery() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: api.watchlist,
    staleTime: 30_000,
  })
}
