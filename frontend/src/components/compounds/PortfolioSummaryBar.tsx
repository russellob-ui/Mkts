'use client'
import type { Portfolio } from '@/types/portfolio'
import { formatLargeNumber, formatChange } from '@/lib/utils'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Skeleton } from '@/components/primitives/Skeleton'

interface PortfolioSummaryBarProps {
  data: Portfolio | null | undefined
  isLoading?: boolean
}

export function PortfolioSummaryBar({ data, isLoading }: PortfolioSummaryBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-6 px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
    )
  }

  if (!data) return null

  const totalValue = data.totalValueGBP ?? data.totalValue
  const dayPnL = data.dayPnLGBP ?? data.dayPnL

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg">
      {/* Total value */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">Total Value</span>
        <span className="text-[20px] font-semibold text-[var(--color-text-primary)] tabular-nums">
          {formatLargeNumber(totalValue)}
        </span>
      </div>

      {/* Day P&L */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">Day P&L</span>
        <div className="flex items-center gap-2">
          <span className={`text-[16px] font-semibold tabular-nums ${dayPnL >= 0 ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
            {dayPnL >= 0 ? '+' : ''}{formatLargeNumber(Math.abs(dayPnL))}
          </span>
          <ChangeCell value={data.dayChangePct} className="text-[13px]" />
        </div>
      </div>

      {/* Yield */}
      {data.portfolioYield != null && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">Yield</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-primary)] tabular-nums">
            {data.portfolioYield.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Holdings count */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">Holdings</span>
        <span className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          {data.holdingsCount ?? data.holdings.length}
        </span>
      </div>

      {/* Benchmark */}
      {data.benchmark && (
        <div className="ml-auto">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">
            vs {data.benchmark.benchmarkName}
          </span>
          <div className="flex items-center gap-2">
            <ChangeCell value={data.benchmark.portfolioChangePct} className="text-[13px]" />
            <span className="text-[11px] text-[var(--color-text-muted)]">vs</span>
            <ChangeCell value={data.benchmark.benchmarkChangePct} className="text-[13px]" />
          </div>
        </div>
      )}
    </div>
  )
}
