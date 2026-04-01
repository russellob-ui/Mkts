'use client'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { FinancialAnalytics } from '@/types/financials'

interface QualityRadarProps {
  analytics: FinancialAnalytics | null | undefined
}

function normalize(val: number | null, min: number, max: number): number {
  if (val == null) return 0
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))
}

export function QualityRadar({ analytics }: QualityRadarProps) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-48 text-[12px] text-[var(--color-text-muted)]">
        No data for quality scoring
      </div>
    )
  }

  const data = [
    { axis: 'Margin', value: normalize(analytics.grossMargin, 0, 0.6) },
    { axis: 'Cash', value: normalize(analytics.freeCashFlowMargin, -0.1, 0.3) },
    { axis: 'Returns', value: normalize(analytics.roe, 0, 0.4) },
    { axis: 'Safety', value: normalize(analytics.debtToEquity != null ? 1 / (1 + analytics.debtToEquity) : null, 0, 1) },
    { axis: 'Growth', value: normalize(analytics.revenueGrowth, -0.1, 0.3) },
    { axis: 'Efficiency', value: normalize(analytics.operatingMargin, 0, 0.4) },
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="var(--color-border-subtle)" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        />
        <Radar
          dataKey="value"
          stroke="var(--color-accent)"
          fill="var(--color-accent)"
          fillOpacity={0.15}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
