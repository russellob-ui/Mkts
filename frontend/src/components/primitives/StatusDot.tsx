'use client'
import { cn } from '@/lib/utils'
import { usePriceStore } from '@/stores/priceStore'

interface StatusDotProps {
  className?: string
}

export function StatusDot({ className }: StatusDotProps) {
  const connected = usePriceStore((s) => s.connected)

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          connected
            ? 'bg-[var(--color-gain)] shadow-[0_0_4px_var(--color-gain)]'
            : 'bg-[var(--color-loss)]'
        )}
      />
      <span className="text-[11px] text-[var(--color-text-muted)]">
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  )
}
