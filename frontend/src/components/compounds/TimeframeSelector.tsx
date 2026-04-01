'use client'
import { cn } from '@/lib/utils'
import type { ChartPeriod } from '@/types/market'

interface TimeframeSelectorProps {
  value: ChartPeriod
  onChange: (period: ChartPeriod) => void
  className?: string
}

const periods: Array<{ label: string; value: ChartPeriod }> = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: '5Y', value: '5y' },
]

export function TimeframeSelector({ value, onChange, className }: TimeframeSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-2 py-1 rounded text-[11px] font-medium transition-colors',
            value === p.value
              ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-bright)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
