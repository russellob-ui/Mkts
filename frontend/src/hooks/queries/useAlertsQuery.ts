'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAlertsQuery() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts,
    staleTime: 30_000,
  })
}
