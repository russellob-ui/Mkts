'use client'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/uiStore'

interface TickerProps {
  symbol: string
  clickable?: boolean
  className?: string
}

export function Ticker({ symbol, clickable = true, className }: TickerProps) {
  const router = useRouter()
  const setActiveTicker = useUIStore((s) => s.setActiveTicker)
  const setActiveSpace = useUIStore((s) => s.setActiveSpace)

  const handleClick = () => {
    if (!clickable) return
    setActiveTicker(symbol)
    setActiveSpace('research')
    router.push(`/research/${encodeURIComponent(symbol)}`)
  }

  return (
    <span
      className={cn(
        'font-mono text-[12px] font-semibold text-[var(--color-accent-bright)]',
        clickable && 'cursor-pointer hover:text-[var(--color-accent)] hover:underline',
        className
      )}
      onClick={clickable ? handleClick : undefined}
    >
      {symbol}
    </span>
  )
}
