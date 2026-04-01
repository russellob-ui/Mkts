'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWatchlistStore } from '@/stores/watchlistStore'

export function useAddToWatchlist() {
  const qc = useQueryClient()
  const addLocal = useWatchlistStore((s) => s.add)

  return useMutation({
    mutationFn: (ticker: string) => api.watchlistAdd(ticker),
    onMutate: (ticker) => {
      addLocal(ticker)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient()
  const removeLocal = useWatchlistStore((s) => s.remove)

  return useMutation({
    mutationFn: (ticker: string) => api.watchlistRemove(ticker),
    onMutate: (ticker) => {
      removeLocal(ticker)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}
