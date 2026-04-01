'use client'
import { cn } from '@/lib/utils'

interface PillProps {
  children: React.ReactNode
  color?: string
  className?: string
}

export function Pill({ children, color, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
        className
      )}
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {children}
    </span>
  )
}
