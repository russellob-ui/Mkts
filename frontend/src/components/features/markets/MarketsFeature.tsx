'use client'
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Skeleton } from '@/components/primitives/Skeleton'

export function MarketsFeature() {
  const { data, isLoading } = useMarketsQuery()

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 px-3 py-2 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <div className="flex items-center gap-5 px-3 py-1.5 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {data.map((item) => (
        <div key={item.symbol} className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
            {item.symbol}
          </span>
          <CurrencyValue value={item.price} className="text-[11px]" />
          <ChangeCell value={item.changePct} className="text-[10px]" />
        </div>
      ))}
    </div>
  )
}
