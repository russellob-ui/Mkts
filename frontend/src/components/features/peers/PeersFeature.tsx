'use client'
import { usePeersQuery } from '@/hooks/queries/usePeersQuery'
import { PeerTable } from '@/components/compounds/PeerTable'
import { PanelHeader } from '@/components/primitives/PanelHeader'

interface PeersFeatureProps {
  ticker: string
}

export function PeersFeature({ ticker }: PeersFeatureProps) {
  const { data, isLoading } = usePeersQuery(ticker)

  return (
    <div>
      <PanelHeader title="Peers" />
      <PeerTable peers={data ?? []} isLoading={isLoading} />
    </div>
  )
}
