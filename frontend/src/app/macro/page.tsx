'use client'
import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { MacroFeature } from '@/components/features/macro/MacroFeature'

export default function MacroPage() {
  const setActiveSpace = useUIStore((s) => s.setActiveSpace)

  useEffect(() => {
    setActiveSpace('macro')
  }, [])

  return (
    <div className="h-[calc(100vh-44px)]">
      <MacroFeature />
    </div>
  )
}
