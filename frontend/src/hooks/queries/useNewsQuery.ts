'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useNewsQuery(ticker?: string) {
  return useQuery({
    queryKey: ['news', ticker ?? 'global'],
    queryFn: () => api.news(ticker),
    enabled: !!ticker,
    staleTime: 120_000,
  })
}
