'use client'
import { useMemo } from 'react'
import { usePortfolioQuery } from '@/hooks/queries/usePortfolioQuery'
import { useWebSocket } from '@/hooks/useWebSocket'
import { PortfolioSummaryBar } from '@/components/compounds/PortfolioSummaryBar'
import { HoldingsTable } from '@/components/compounds/HoldingsTable'
import { ExposureTreemap } from '@/components/compounds/ExposureTreemap'
import { TaxWrapperBar } from '@/components/compounds/TaxWrapperBar'
import { ImportFlow } from '@/components/compounds/ImportFlow'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import { SpacePanel } from '@/components/layout/SpaceLayout'

export function PortfolioFeature() {
  const { data, isLoading, isError } = usePortfolioQuery()

  const holdingTickers = useMemo(() => {
    if (!data?.holdings) return []
    return data.holdings.map((h: any) => h.ticker)
  }, [data?.holdings])

  useWebSocket(holdingTickers)

  const hasHoldings = data && data.holdings && data.holdings.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[13px] text-[var(--color-text-muted)]">
        Loading portfolio...
      </div>
    )
  }

  if (isError || (!isLoading && !hasHoldings)) {
    return <ImportFlow />
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <PortfolioSummaryBar data={data} isLoading={isLoading} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-2 min-h-0">
        <SpacePanel className="overflow-y-auto p-3">
          <PanelHeader title="Holdings" />
          <HoldingsTable holdings={data?.holdings ?? []} isLoading={isLoading} />
        </SpacePanel>

        <div className="flex flex-col gap-2 overflow-hidden">
          <SpacePanel className="p-3">
            <PanelHeader title="Sector Allocation" />
            <ExposureTreemap data={data?.sectorExposure ?? []} height={180} />
          </SpacePanel>

          <SpacePanel className="p-3">
            <PanelHeader title="Country Exposure" />
            <ExposureTreemap data={data?.countryExposure ?? []} height={140} />
          </SpacePanel>

          <SpacePanel className="p-3 overflow-y-auto">
            <PanelHeader title="Tax Wrappers" />
            <TaxWrapperBar holdings={data?.holdings ?? []} />
          </SpacePanel>
        </div>
      </div>
    </div>
  )
}
