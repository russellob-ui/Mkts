'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ChartPeriod } from '@/types/market'

export function useChartQuery(ticker: string | null, period: ChartPeriod = '1y') {
  return useQuery({
    queryKey: ['chart', ticker, period],
    queryFn: () => api.charts(ticker!, period),
    enabled: !!ticker,
    staleTime: 5 * 60_000,
  })
}
