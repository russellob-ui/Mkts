'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useMarketsQuery() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: api.markets,
    staleTime: 60_000,
  })
}
