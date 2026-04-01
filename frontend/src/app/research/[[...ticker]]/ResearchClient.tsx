'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { SpaceLayout, SpacePanel } from '@/components/layout/SpaceLayout'
import { CompanyFeature } from '@/components/features/company/CompanyFeature'
import { ChartFeature } from '@/components/features/chart/ChartFeature'
import { FinancialsFeature } from '@/components/features/financials/FinancialsFeature'
import { PeersFeature } from '@/components/features/peers/PeersFeature'
import { NewsFeature } from '@/components/features/news/NewsFeature'
import { BriefFeature } from '@/components/features/brief/BriefFeature'
import { Search } from 'lucide-react'

type Tab = 'overview' | 'financials' | 'peers' | 'news'

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'financials', label: 'Financials' },
  { key: 'peers', label: 'Peers' },
  { key: 'news', label: 'News' },
]

export function ResearchClient() {
  const params = useParams()
  const tickerSegments = params.ticker as string[] | undefined
  const ticker = tickerSegments?.[0] ? decodeURIComponent(tickerSegments[0]).toUpperCase() : null
  const { setActiveTicker, setActiveSpace, toggleCommandPalette } = useUIStore()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    setActiveSpace('research')
    if (ticker) setActiveTicker(ticker)
  }, [ticker])

  if (!ticker) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-44px)] gap-4">
        <Search size={32} className="text-[var(--color-text-muted)]" />
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          Search for a ticker to start researching
        </p>
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-bright)]"
        >
          Open Search
          <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>
    )
  }

  return (
    <SpaceLayout space="research">
      {/* Left column: Chart + Tabbed content */}
      <SpacePanel className="flex flex-col overflow-hidden">
        <div className="border-b border-[var(--color-border-subtle)]">
          <CompanyFeature ticker={ticker} />
        </div>

        <div className="p-3 border-b border-[var(--color-border-subtle)]">
          <ChartFeature ticker={ticker} />
        </div>

        <div className="flex items-center gap-1 px-3 pt-2 border-b border-[var(--color-border-subtle)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-accent-bright)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'overview' && <BriefFeature ticker={ticker} />}
          {activeTab === 'financials' && <FinancialsFeature ticker={ticker} />}
          {activeTab === 'peers' && <PeersFeature ticker={ticker} />}
          {activeTab === 'news' && <NewsFeature ticker={ticker} maxItems={20} />}
        </div>
      </SpacePanel>

      {/* Right column: AI Brief + News */}
      <div className="flex flex-col gap-2 overflow-hidden">
        <SpacePanel className="overflow-y-auto">
          <div className="p-3">
            <BriefFeature ticker={ticker} mode="analyst" />
          </div>
        </SpacePanel>

        <SpacePanel className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3">
            <NewsFeature ticker={ticker} maxItems={8} />
          </div>
        </SpacePanel>
      </div>
    </SpaceLayout>
  )
}
