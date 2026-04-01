'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useBriefQuery(ticker?: string, mode?: 'concise' | 'analyst') {
  return useQuery({
    queryKey: ['brief', ticker ?? 'global', mode ?? 'concise'],
    queryFn: () => api.brief(ticker, mode),
    staleTime: 300_000,
  })
}
