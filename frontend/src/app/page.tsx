'use client'
import { SpaceLayout, SpacePanel } from '@/components/layout/SpaceLayout'
import { MarketsFeature } from '@/components/features/markets/MarketsFeature'
import { MarketMonitorFeature } from '@/components/features/monitor/MarketMonitorFeature'
import { WatchlistFeature } from '@/components/features/watchlist/WatchlistFeature'
import { PanelHeader } from '@/components/primitives/PanelHeader'

export default function MonitorPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-44px)]">
      {/* Markets ticker strip */}
      <MarketsFeature />

      {/* Main content */}
      <SpaceLayout space="monitor" className="flex-1">
        {/* Left column: Market monitor table */}
        <SpacePanel className="p-3">
          <MarketMonitorFeature />
        </SpacePanel>

        {/* Right column: Watchlist */}
        <SpacePanel className="overflow-y-auto">
          <WatchlistFeature />
        </SpacePanel>
      </SpaceLayout>
    </div>
  )
}
