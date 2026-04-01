'use client'
import { SpaceLayout, SpacePanel } from '@/components/layout/SpaceLayout'
import { MarketsFeature } from '@/components/features/markets/MarketsFeature'
import { MarketMonitorFeature } from '@/components/features/monitor/MarketMonitorFeature'
import { WatchlistFeature } from '@/components/features/watchlist/WatchlistFeature'
import { NewsFeature } from '@/components/features/news/NewsFeature'
import { BriefFeature } from '@/components/features/brief/BriefFeature'

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

        {/* Right column: Watchlist + Brief + News stacked */}
        <div className="flex flex-col gap-2 overflow-hidden">
          <SpacePanel className="shrink-0 max-h-[35%] overflow-y-auto">
            <WatchlistFeature />
          </SpacePanel>

          <SpacePanel className="shrink-0 max-h-[30%] overflow-y-auto">
            <BriefFeature />
          </SpacePanel>

          <SpacePanel className="flex-1 min-h-0 overflow-y-auto">
            <NewsFeature maxItems={15} />
          </SpacePanel>
        </div>
      </SpaceLayout>
    </div>
  )
}
