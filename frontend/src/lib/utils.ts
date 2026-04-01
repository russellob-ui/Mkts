import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatLargeNumber(value: number, currency = '£'): string {
  if (value >= 1e9) return `${currency}${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${currency}${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${currency}${(value / 1e3).toFixed(1)}K`
  return `${currency}${value.toFixed(2)}`
}

export function formatChange(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatPrice(value: number, currency = 'GBP'): string {
  if (currency === 'GBX' || currency === 'GBp') {
    return `${value.toFixed(2)}p`
  }
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'
  return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`
  return value.toString()
}

export function formatMarketCap(value: number): string {
  return formatLargeNumber(value)
}

export function isPositive(value: number): boolean {
  return value > 0
}

export function changeColor(value: number): string {
  if (value > 0) return 'text-[var(--color-gain)]'
  if (value < 0) return 'text-[var(--color-loss)]'
  return 'text-[var(--color-text-secondary)]'
}

export function changeBg(value: number): string {
  if (value > 0) return 'bg-[var(--color-gain-dim)] text-[var(--color-gain)]'
  if (value < 0) return 'bg-[var(--color-loss-dim)] text-[var(--color-loss)]'
  return 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatDelta(value: number | null | undefined, currency = 'GBP'): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPrice(value, currency)}`
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
