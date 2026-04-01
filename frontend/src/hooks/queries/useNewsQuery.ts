'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useNewsQuery(ticker?: string) {
  return useQuery({
    queryKey: ['news', ticker ?? 'global'],
    queryFn: () => api.news(ticker),
    staleTime: 120_000,
  })
}
