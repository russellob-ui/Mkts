'use client'
import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePriceStore } from '@/stores/priceStore'
import { Ticker } from '@/components/primitives/Ticker'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Skeleton } from '@/components/primitives/Skeleton'
import { X } from 'lucide-react'

interface WatchlistTableProps {
  tickers: string[]
  onRemove?: (ticker: string) => void
  compact?: boolean
}

export function WatchlistTable({ tickers, onRemove, compact }: WatchlistTableProps) {
  const prices = usePriceStore((s) => s.prices)

  const quoteQueries = useQueries({
    queries: tickers.map((ticker) => ({
      queryKey: ['quote', ticker],
      queryFn: () => api.quote(ticker),
      staleTime: 30_000,
    })),
  })

  const rows = useMemo(() => {
    return tickers.map((ticker, i) => {
      const query = quoteQueries[i]
      const live = prices[ticker]
      const rest = query?.data

      return {
        ticker,
        name: rest?.name ?? '',
        price: live?.price ?? rest?.price ?? null,
        changePct: live?.changePct ?? rest?.changePct ?? null,
        currency: rest?.currency ?? 'GBP',
        loading: query?.isLoading ?? true,
      }
    })
  }, [tickers, quoteQueries, prices])

  if (tickers.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[12px] text-[var(--color-text-muted)]">
        No tickers in watchlist
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-border-subtle)]">
      {rows.map((row) => (
        <div
          key={row.ticker}
          className="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-bg-elevated)] transition-colors group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Ticker symbol={row.ticker} />
            {!compact && (
              <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[100px]">
                {row.loading ? <Skeleton className="h-3 w-16 inline-block" /> : row.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {row.loading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              <>
                <CurrencyValue value={row.price} currency={row.currency} className="text-[12px]" />
                <ChangeCell value={row.changePct} className="text-[11px] w-14 text-right" />
              </>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(row.ticker)
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] transition-opacity"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
