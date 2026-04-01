'use client'
import { Skeleton } from '@/components/primitives/Skeleton'
import { ChangeCell } from '@/components/primitives/ChangeCell'

interface MacroIndicator {
  name: string
  value: number | string | null
  unit?: string
  previousValue?: number | null
  category?: string
  date?: string
}

interface MacroIndicatorGridProps {
  data: any
  isLoading?: boolean
  onSelect?: (indicator: MacroIndicator) => void
  selectedName?: string | null
}

function parseIndicators(data: any): MacroIndicator[] {
  if (!data) return []

  // Handle various backend response shapes
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      name: item.name ?? item.label ?? item.series_id ?? 'Unknown',
      value: item.value ?? item.latest_value ?? null,
      unit: item.unit ?? item.units ?? '',
      previousValue: item.previous_value ?? item.previousValue ?? null,
      category: item.category ?? item.group ?? '',
      date: item.date ?? item.observation_date ?? null,
    }))
  }

  // Object shape: keys are indicator names
  if (typeof data === 'object') {
    return Object.entries(data).map(([key, val]: [string, any]) => ({
      name: key,
      value: typeof val === 'object' ? val?.value ?? val?.latest ?? null : val,
      unit: typeof val === 'object' ? val?.unit ?? val?.units ?? '' : '',
      previousValue: typeof val === 'object' ? val?.previous ?? null : null,
      category: typeof val === 'object' ? val?.category ?? '' : '',
      date: typeof val === 'object' ? val?.date ?? null : null,
    }))
  }

  return []
}

function groupByCategory(indicators: MacroIndicator[]): Record<string, MacroIndicator[]> {
  const groups: Record<string, MacroIndicator[]> = {}
  for (const ind of indicators) {
    const cat = ind.category || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ind)
  }
  return groups
}

export function MacroIndicatorGrid({ data, isLoading, onSelect, selectedName }: MacroIndicatorGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }

  const indicators = parseIndicators(data)
  if (indicators.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[12px] text-[var(--color-text-muted)]">
        No macro data available
      </div>
    )
  }

  const groups = groupByCategory(indicators)

  return (
    <div className="divide-y divide-[var(--color-border-subtle)]">
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <div className="px-3 py-1.5 bg-[var(--color-bg-elevated)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {category}
            </span>
          </div>
          {items.map((ind) => {
            const change = ind.previousValue != null && typeof ind.value === 'number'
              ? ind.value - ind.previousValue
              : null

            return (
              <div
                key={ind.name}
                className={`flex items-center justify-between px-3 py-2 hover:bg-[var(--color-bg-elevated)] transition-colors ${
                  onSelect ? 'cursor-pointer' : ''
                } ${selectedName === ind.name ? 'bg-[var(--color-accent-dim)]' : ''}`}
                onClick={() => onSelect?.(ind)}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] text-[var(--color-text-secondary)] truncate block">
                    {ind.name}
                  </span>
                  {ind.date && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">{ind.date}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium text-[var(--color-text-primary)] tabular-nums">
                    {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value ?? '—'}
                    {ind.unit && <span className="text-[10px] text-[var(--color-text-muted)] ml-0.5">{ind.unit}</span>}
                  </span>
                  {change != null && (
                    <ChangeCell value={ind.previousValue !== 0 ? (change / Math.abs(ind.previousValue!)) * 100 : 0} className="text-[11px] w-14 text-right" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
