'use client'
import { useFinancialsQuery } from '@/hooks/queries/useFinancialsQuery'
import { FinancialsTable } from '@/components/compounds/FinancialsTable'
import { QualityRadar } from '@/components/compounds/QualityRadar'
import { PanelHeader } from '@/components/primitives/PanelHeader'

interface FinancialsFeatureProps {
  ticker: string
}

export function FinancialsFeature({ ticker }: FinancialsFeatureProps) {
  const { data, isLoading } = useFinancialsQuery(ticker)

  return (
    <div>
      <PanelHeader title="Financials" />
      <FinancialsTable data={data} isLoading={isLoading} />
      {data?.analytics && (
        <div className="mt-3">
          <PanelHeader title="Quality Score" />
          <QualityRadar analytics={data.analytics} />
        </div>
      )}
    </div>
  )
}
