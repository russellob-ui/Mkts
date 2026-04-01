'use client'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'gain' | 'loss' | 'warn' | 'accent' | 'muted'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
  gain: 'bg-[var(--color-gain-dim)] text-[var(--color-gain)]',
  loss: 'bg-[var(--color-loss-dim)] text-[var(--color-loss)]',
  warn: 'bg-amber-500/10 text-[var(--color-warn)]',
  accent: 'bg-[var(--color-accent-dim)] text-[var(--color-accent-bright)]',
  muted: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
