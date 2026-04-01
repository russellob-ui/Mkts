'use client'
import { useEffect } from 'react'
import { useWatchlistQuery } from '@/hooks/queries/useWatchlistQuery'
import { useRemoveFromWatchlist } from '@/hooks/mutations/useWatchlistMutations'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { WatchlistTable } from '@/components/compounds/WatchlistTable'
import { PanelHeader } from '@/components/primitives/PanelHeader'

export function WatchlistFeature() {
  const { data: serverTickers } = useWatchlistQuery()
  const localTickers = useWatchlistStore((s) => s.tickers)
  const setTickers = useWatchlistStore((s) => s.setTickers)
  const removeMutation = useRemoveFromWatchlist()

  // Sync server → local store
  useEffect(() => {
    if (serverTickers && Array.isArray(serverTickers)) {
      setTickers(serverTickers)
    }
  }, [serverTickers])

  const tickers = localTickers.length > 0 ? localTickers : (serverTickers ?? [])

  // Subscribe to WS for live prices
  useWebSocket(tickers)

  return (
    <div>
      <PanelHeader title="Watchlist" />
      <WatchlistTable
        tickers={tickers}
        onRemove={(ticker) => removeMutation.mutate(ticker)}
        compact
      />
    </div>
  )
}
