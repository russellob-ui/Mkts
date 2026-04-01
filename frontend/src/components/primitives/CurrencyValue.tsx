'use client'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils'

interface CurrencyValueProps {
  value: number | null | undefined
  currency?: string
  className?: string
}

export function CurrencyValue({ value, currency = 'GBP', className }: CurrencyValueProps) {
  if (value == null) {
    return <span className={cn('text-[var(--color-text-muted)]', className)}>—</span>
  }

  return (
    <span className={cn('tabular-nums text-[var(--color-text-primary)]', className)}>
      {formatPrice(value, currency)}
    </span>
  )
}
