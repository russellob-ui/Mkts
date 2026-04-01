'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useFinancialsQuery(ticker: string | null) {
  return useQuery({
    queryKey: ['financials', ticker],
    queryFn: () => api.financials(ticker!),
    enabled: !!ticker,
    staleTime: 3600_000,
  })
}
