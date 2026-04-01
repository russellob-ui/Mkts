'use client'
import type { CompanyDetail } from '@/types/market'
import { DataRow } from '@/components/primitives/DataRow'
import { formatLargeNumber, formatPrice } from '@/lib/utils'

interface FundamentalsBlockProps {
  data: CompanyDetail | null | undefined
}

export function FundamentalsBlock({ data }: FundamentalsBlockProps) {
  if (!data) return null

  const rows = [
    { label: 'Market Cap', value: data.marketCap != null ? formatLargeNumber(data.marketCap) : '—' },
    { label: 'P/E (TTM)', value: data.trailingPE?.toFixed(1) ?? '—' },
    { label: 'P/E (Fwd)', value: data.forwardPE?.toFixed(1) ?? '—' },
    { label: 'Div Yield', value: data.dividendYield != null ? `${data.dividendYield.toFixed(2)}%` : '—' },
    { label: 'Volume', value: data.volume != null ? data.volume.toLocaleString() : '—' },
    { label: 'Avg Volume', value: data.averageVolume != null ? data.averageVolume.toLocaleString() : '—' },
    { label: 'Open', value: data.open != null ? formatPrice(data.open, data.currency) : '—' },
    { label: 'Day High', value: data.dayHigh != null ? formatPrice(data.dayHigh, data.currency) : '—' },
    { label: 'Day Low', value: data.dayLow != null ? formatPrice(data.dayLow, data.currency) : '—' },
    { label: '52W High', value: data.fiftyTwoWeekHigh != null ? formatPrice(data.fiftyTwoWeekHigh, data.currency) : '—' },
    { label: '52W Low', value: data.fiftyTwoWeekLow != null ? formatPrice(data.fiftyTwoWeekLow, data.currency) : '—' },
    { label: 'Prev Close', value: data.previousClose != null ? formatPrice(data.previousClose, data.currency) : '—' },
  ]

  return (
    <div className="divide-y divide-[var(--color-border-subtle)]">
      {rows.map((row) => (
        <DataRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  )
}
