'use client'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ChangeCellProps {
  value: number | null | undefined
  showIcon?: boolean
  className?: string
}

export function ChangeCell({ value, showIcon = false, className }: ChangeCellProps) {
  if (value == null) {
    return <span className={cn('text-[var(--color-text-muted)]', className)}>—</span>
  }

  const isPositive = value > 0
  const isNegative = value < 0
  const sign = isPositive ? '+' : ''
  const color = isPositive
    ? 'text-[var(--color-gain)]'
    : isNegative
      ? 'text-[var(--color-loss)]'
      : 'text-[var(--color-text-secondary)]'

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', color, className)}>
      {showIcon && <Icon className="w-3 h-3" />}
      {sign}{value.toFixed(2)}%
    </span>
  )
}
