'use client'
import { cn } from '@/lib/utils'

interface PanelHeaderProps {
  title: string
  actions?: React.ReactNode
  className?: string
}

export function PanelHeader({ title, actions, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
        {title}
      </h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
