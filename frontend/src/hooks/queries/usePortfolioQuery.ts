'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function usePortfolioQuery() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: api.portfolio,
    staleTime: 30_000,
  })
}

export function usePortfolioAnalyticsQuery() {
  return useQuery({
    queryKey: ['portfolio-analytics'],
    queryFn: api.portfolioAnalytics,
    staleTime: 60_000,
  })
}
