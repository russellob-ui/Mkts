'use client'
import { useState } from 'react'
import { useChartQuery } from '@/hooks/queries/useChartQuery'
import { CandleChart } from '@/components/compounds/CandleChart'
import { TimeframeSelector } from '@/components/compounds/TimeframeSelector'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import type { ChartPeriod } from '@/types/market'

interface ChartFeatureProps {
  ticker: string
}

export function ChartFeature({ ticker }: ChartFeatureProps) {
  const [period, setPeriod] = useState<ChartPeriod>('1y')
  const { data, isLoading } = useChartQuery(ticker, period)

  return (
    <div>
      <PanelHeader
        title="Price"
        actions={<TimeframeSelector value={period} onChange={setPeriod} />}
      />
      <CandleChart
        candles={data?.candles}
        isLoading={isLoading}
      />
    </div>
  )
}
