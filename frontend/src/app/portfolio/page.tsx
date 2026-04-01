'use client'
import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { PortfolioFeature } from '@/components/features/portfolio/PortfolioFeature'

export default function PortfolioPage() {
  const setActiveSpace = useUIStore((s) => s.setActiveSpace)

  useEffect(() => {
    setActiveSpace('portfolio')
  }, [])

  return (
    <div className="h-[calc(100vh-44px)] p-2">
      <PortfolioFeature />
    </div>
  )
}
