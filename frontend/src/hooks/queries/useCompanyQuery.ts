'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CompanyDetail } from '@/types/market'
import { usePriceStore } from '@/stores/priceStore'
import { useEffect } from 'react'

export function useCompanyQuery(ticker: string | null) {
  const setPreviousClose = usePriceStore((s) => s.setPreviousClose)

  const query = useQuery({
    queryKey: ['company', ticker],
    queryFn: () => api.company(ticker!),
    enabled: !!ticker,
    staleTime: 60_000,
  })

  // Seed previousClose for WebSocket change derivation
  useEffect(() => {
    if (query.data?.previousClose && ticker) {
      setPreviousClose(ticker, query.data.previousClose)
    }
  }, [query.data?.previousClose, ticker])

  return query
}
