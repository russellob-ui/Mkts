'use client'
import { useBriefQuery } from '@/hooks/queries/useBriefQuery'
import { BriefPanel } from '@/components/compounds/BriefPanel'
import { useQueryClient } from '@tanstack/react-query'

interface BriefFeatureProps {
  ticker?: string
  mode?: 'concise' | 'analyst'
}

export function BriefFeature({ ticker, mode = 'concise' }: BriefFeatureProps) {
  const { data, isLoading } = useBriefQuery(ticker, mode)
  const qc = useQueryClient()

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['brief', ticker ?? 'global', mode] })
  }

  return (
    <BriefPanel
      brief={data}
      isLoading={isLoading}
      onRefresh={handleRefresh}
    />
  )
}
