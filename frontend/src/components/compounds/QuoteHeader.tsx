'use client'
import type { CompanyDetail } from '@/types/market'
import { usePriceStore } from '@/stores/priceStore'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Badge } from '@/components/primitives/Badge'
import { Skeleton } from '@/components/primitives/Skeleton'
import { Plus, Check } from 'lucide-react'

interface QuoteHeaderProps {
  data: CompanyDetail | null | undefined
  isLoading?: boolean
  isWatchlisted?: boolean
  onToggleWatchlist?: () => void
}

const marketStateBadge = (state: string | null) => {
  switch (state) {
    case 'REGULAR': return <Badge variant="gain">OPEN</Badge>
    case 'PRE': return <Badge variant="warn">PRE</Badge>
    case 'POST': return <Badge variant="warn">POST</Badge>
    case 'CLOSED': return <Badge variant="muted">CLOSED</Badge>
    default: return null
  }
}

export function QuoteHeader({ data, isLoading, isWatchlisted, onToggleWatchlist }: QuoteHeaderProps) {
  const livePrice = usePriceStore((s) => data ? s.getPrice(data.ticker) : undefined)

  if (isLoading || !data) {
    return (
      <div className="px-4 py-3 space-y-2">
        <Skeleton className="h-5 w-48" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    )
  }

  const price = livePrice?.price ?? data.price
  const changePct = livePrice?.changePct ?? data.changePct
  const change = livePrice?.change ?? data.change

  return (
    <div className="px-4 py-3">
      {/* Top row: name + badges */}
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          {data.name}
        </h1>
        <span className="text-[12px] font-mono text-[var(--color-accent-bright)]">
          {data.ticker}
        </span>
        {marketStateBadge(data.marketState)}
        {data.sector && (
          <Badge variant="default">{data.sector}</Badge>
        )}
      </div>

      {/* Price row */}
      <div className="flex items-center gap-3">
        <CurrencyValue
          value={price}
          currency={data.currency}
          className="text-[22px] font-semibold"
        />
        <ChangeCell value={changePct} showIcon className="text-[14px]" />
        <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">
          {change != null && (change > 0 ? '+' : '')}{change?.toFixed(2)} {data.currency}
        </span>

        {/* Watchlist toggle */}
        {onToggleWatchlist && (
          <button
            onClick={onToggleWatchlist}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors"
            style={{
              borderColor: isWatchlisted ? 'var(--color-accent)' : 'var(--color-border-default)',
              color: isWatchlisted ? 'var(--color-accent-bright)' : 'var(--color-text-secondary)',
              backgroundColor: isWatchlisted ? 'var(--color-accent-dim)' : 'transparent',
            }}
          >
            {isWatchlisted ? <Check size={11} /> : <Plus size={11} />}
            {isWatchlisted ? 'Watching' : 'Watch'}
          </button>
        )}
      </div>
    </div>
  )
}
