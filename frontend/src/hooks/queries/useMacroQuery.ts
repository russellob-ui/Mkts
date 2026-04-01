'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useMacroQuery() {
  return useQuery({
    queryKey: ['macro'],
    queryFn: api.macro,
    staleTime: 3600_000,
  })
}
