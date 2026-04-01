'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function usePeersQuery(ticker: string | null) {
  return useQuery({
    queryKey: ['peers', ticker],
    queryFn: () => api.peers(ticker!),
    enabled: !!ticker,
    staleTime: 600_000,
  })
}
