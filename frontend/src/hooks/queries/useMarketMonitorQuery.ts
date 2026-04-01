'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useMarketMonitorQuery() {
  return useQuery({
    queryKey: ['market-monitor'],
    queryFn: api.marketMonitor,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
