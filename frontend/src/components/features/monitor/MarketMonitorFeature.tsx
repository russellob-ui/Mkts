'use client'
import { useMarketMonitorQuery } from '@/hooks/queries/useMarketMonitorQuery'
import { MarketTable } from '@/components/compounds/MarketTable'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import { Badge } from '@/components/primitives/Badge'

export function MarketMonitorFeature() {
  const { data, isLoading, dataUpdatedAt } = useMarketMonitorQuery()

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div>
      <PanelHeader
        title="Market Monitor"
        actions={
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant="muted">{data.length} instruments</Badge>
            )}
            {updatedTime && (
              <span className="text-[10px] text-[var(--color-text-muted)]">{updatedTime}</span>
            )}
          </div>
        }
      />
      <MarketTable data={data ?? []} isLoading={isLoading} />
    </div>
  )
}
