'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useSearchQuery(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length >= 1,
    staleTime: 30_000,
  })
}
