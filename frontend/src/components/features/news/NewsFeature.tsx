'use client'
import { useNewsQuery } from '@/hooks/queries/useNewsQuery'
import { NewsStream } from '@/components/compounds/NewsStream'
import { PanelHeader } from '@/components/primitives/PanelHeader'

interface NewsFeatureProps {
  ticker?: string
  maxItems?: number
}

export function NewsFeature({ ticker, maxItems = 10 }: NewsFeatureProps) {
  const { data, isLoading } = useNewsQuery(ticker)

  return (
    <div>
      <PanelHeader title={ticker ? `${ticker} News` : 'News'} />
      <NewsStream
        articles={data ?? []}
        isLoading={isLoading}
        maxItems={maxItems}
      />
    </div>
  )
}
