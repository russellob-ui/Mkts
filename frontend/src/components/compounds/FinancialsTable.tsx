'use client'
import type { Financials } from '@/types/financials'
import { formatLargeNumber } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/Skeleton'

interface FinancialsTableProps {
  data: Financials | null | undefined
  isLoading?: boolean
}

const metricRows: Array<{ key: string; label: string; format?: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'grossProfit', label: 'Gross Profit' },
  { key: 'operatingIncome', label: 'Operating Income' },
  { key: 'netIncome', label: 'Net Income' },
  { key: 'epsBasic', label: 'EPS', format: 'number' },
  { key: 'operatingCashFlow', label: 'Operating CF' },
  { key: 'freeCashFlow', label: 'Free Cash Flow' },
  { key: 'totalAssets', label: 'Total Assets' },
  { key: 'totalDebt', label: 'Total Debt' },
  { key: 'totalEquity', label: 'Equity' },
]

export function FinancialsTable({ data, isLoading }: FinancialsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    )
  }

  if (!data || !data.periods || data.periods.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[12px] text-[var(--color-text-muted)]">
        No financial data available
      </div>
    )
  }

  const periods = data.periods.slice(0, 5)
  const currency = data.currency === 'GBX' || data.currency === 'GBp' ? '£' : data.currency === 'USD' ? '$' : '£'

  const formatVal = (val: number | null, format?: string) => {
    if (val == null) return '—'
    if (format === 'number') return val.toFixed(2)
    return formatLargeNumber(val, currency)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)]">
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-surface)]">
              Metric
            </th>
            {periods.map((p) => (
              <th
                key={p.period}
                className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {p.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricRows.map(({ key, label, format }) => (
            <tr key={key} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]">
              <td className="px-3 py-1.5 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg-surface)]">
                {label}
              </td>
              {periods.map((p) => (
                <td key={p.period} className="px-3 py-1.5 text-right text-[var(--color-text-primary)]">
                  {formatVal((p as any)[key], format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Analytics row if available */}
      {data.analytics && (
        <div className="mt-3 px-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {data.analytics.grossMargin != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">Gross Margin</span>
              <span className="text-[var(--color-text-primary)]">{(data.analytics.grossMargin * 100).toFixed(1)}%</span>
            </div>
          )}
          {data.analytics.operatingMargin != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">Op Margin</span>
              <span className="text-[var(--color-text-primary)]">{(data.analytics.operatingMargin * 100).toFixed(1)}%</span>
            </div>
          )}
          {data.analytics.roe != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">ROE</span>
              <span className="text-[var(--color-text-primary)]">{(data.analytics.roe * 100).toFixed(1)}%</span>
            </div>
          )}
          {data.analytics.debtToEquity != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">D/E</span>
              <span className="text-[var(--color-text-primary)]">{data.analytics.debtToEquity.toFixed(2)}x</span>
            </div>
          )}
          {data.analytics.revenueGrowth != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">Rev Growth</span>
              <span className="text-[var(--color-text-primary)]">{(data.analytics.revenueGrowth * 100).toFixed(1)}%</span>
            </div>
          )}
          {data.analytics.freeCashFlowMargin != null && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">FCF Margin</span>
              <span className="text-[var(--color-text-primary)]">{(data.analytics.freeCashFlowMargin * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
