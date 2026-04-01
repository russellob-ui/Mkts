'use client'
import type { Holding } from '@/types/portfolio'
import { useMemo } from 'react'
import { formatLargeNumber } from '@/lib/utils'
import { Badge } from '@/components/primitives/Badge'

interface TaxWrapperBarProps {
  holdings: Holding[]
}

const ISA_ALLOWANCE = 20_000
const CGT_ALLOWANCE = 3_000

export function TaxWrapperBar({ holdings }: TaxWrapperBarProps) {
  const wrappers = useMemo(() => {
    const groups: Record<string, { value: number; count: number; unrealisedGain: number }> = {}

    for (const h of holdings) {
      const account = h.account ?? 'GIA'
      if (!groups[account]) {
        groups[account] = { value: 0, count: 0, unrealisedGain: 0 }
      }
      groups[account].value += h.marketValueGBP ?? h.marketValue
      groups[account].count += 1
      if (h.costBasis != null) {
        groups[account].unrealisedGain += (h.marketValueGBP ?? h.marketValue) - h.costBasis * h.shares
      }
    }

    return groups
  }, [holdings])

  const isaValue = wrappers['ISA']?.value ?? 0
  const giaGain = wrappers['GIA']?.unrealisedGain ?? 0

  return (
    <div className="space-y-3">
      {/* Wrapper breakdown */}
      {Object.entries(wrappers).map(([account, data]) => (
        <div key={account} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={account === 'ISA' ? 'accent' : account === 'SIPP' ? 'warn' : 'default'}>
              {account}
            </Badge>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {data.count} holdings
            </span>
          </div>
          <span className="text-[12px] font-medium text-[var(--color-text-primary)] tabular-nums">
            {formatLargeNumber(data.value)}
          </span>
        </div>
      ))}

      {/* ISA allowance bar */}
      <div className="pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            ISA Allowance Used
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)] tabular-nums">
            {formatLargeNumber(isaValue)} / {formatLargeNumber(ISA_ALLOWANCE)}
          </span>
        </div>
        <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] rounded-full transition-all"
            style={{ width: `${Math.min(100, (isaValue / ISA_ALLOWANCE) * 100)}%` }}
          />
        </div>
      </div>

      {/* CGT exposure */}
      {giaGain !== 0 && (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              GIA Unrealised Gain
            </span>
            <span className={`text-[11px] tabular-nums ${giaGain > CGT_ALLOWANCE ? 'text-[var(--color-warn)]' : 'text-[var(--color-text-secondary)]'}`}>
              {formatLargeNumber(giaGain)}
              {giaGain > CGT_ALLOWANCE && (
                <span className="ml-1 text-[10px]">(exceeds £{CGT_ALLOWANCE.toLocaleString()} allowance)</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
