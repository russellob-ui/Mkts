'use client'
import { useCompanyQuery } from '@/hooks/queries/useCompanyQuery'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useAddToWatchlist, useRemoveFromWatchlist } from '@/hooks/mutations/useWatchlistMutations'
import { QuoteHeader } from '@/components/compounds/QuoteHeader'
import { FundamentalsBlock } from '@/components/compounds/FundamentalsBlock'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import { useMemo } from 'react'

interface CompanyFeatureProps {
  ticker: string
}

export function CompanyFeature({ ticker }: CompanyFeatureProps) {
  const { data, isLoading } = useCompanyQuery(ticker)
  const watchlistTickers = useWatchlistStore((s) => s.tickers)
  const isWatchlisted = watchlistTickers.includes(ticker)
  const addMutation = useAddToWatchlist()
  const removeMutation = useRemoveFromWatchlist()

  const tickers = useMemo(() => [ticker], [ticker])
  useWebSocket(tickers)

  const toggleWatchlist = () => {
    if (isWatchlisted) {
      removeMutation.mutate(ticker)
    } else {
      addMutation.mutate(ticker)
    }
  }

  return (
    <div>
      <QuoteHeader
        data={data}
        isLoading={isLoading}
        isWatchlisted={isWatchlisted}
        onToggleWatchlist={toggleWatchlist}
      />
      <div className="border-t border-[var(--color-border-subtle)]">
        <div className="px-3 pt-3">
          <PanelHeader title="Key Stats" />
        </div>
        <div className="px-3 pb-3">
          <FundamentalsBlock data={data} />
        </div>
      </div>
    </div>
  )
}
