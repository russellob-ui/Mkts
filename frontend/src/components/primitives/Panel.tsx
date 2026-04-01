'use client'
import { cn } from '@/lib/utils'

interface PanelProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function Panel({ children, className, noPadding }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg',
        !noPadding && 'p-4',
        className
      )}
    >
      {children}
    </div>
  )
}
