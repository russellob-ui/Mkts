'use client'
import { cn } from '@/lib/utils'
import type { Space } from '@/stores/uiStore'

interface SpaceLayoutProps {
  space: Space
  children: React.ReactNode
  className?: string
}

const spaceStyles: Record<Space, string> = {
  monitor: 'grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2 h-full',
  research: 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-2 h-full',
  portfolio: 'flex flex-col gap-2 h-full',
  macro: 'grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-2 h-full',
}

export function SpaceLayout({ space, children, className }: SpaceLayoutProps) {
  return (
    <div className={cn('p-2 h-[calc(100vh-44px)] overflow-hidden', spaceStyles[space], className)}>
      {children}
    </div>
  )
}

interface SpacePanelProps {
  children: React.ReactNode
  className?: string
}

export function SpacePanel({ children, className }: SpacePanelProps) {
  return (
    <div
      className={cn(
        'overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg',
        className
      )}
    >
      {children}
    </div>
  )
}
