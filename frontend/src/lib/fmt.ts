/** Number and currency formatting utilities */

export function fmtPrice(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtChange(v: number | null | undefined): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

export function fmtChangePct(v: number | null | undefined): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

export function fmtMarketCap(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6)  return `${(v / 1e6).toFixed(1)}M`
  return fmtPrice(v, 0)
}

export function fmtVolume(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toLocaleString()
}

export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—'
  return `${v.toFixed(decimals)}%`
}

export function fmtGbp(v: number | null | undefined): string {
  if (v == null) return '—'
  return `£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function changeClass(v: number | null | undefined): string {
  if (v == null) return 'text-slate-400'
  return v >= 0 ? 'text-positive' : 'text-negative'
}

export function changeBgClass(v: number | null | undefined): string {
  if (v == null) return ''
  return v >= 0 ? 'bg-positive-dim text-positive' : 'bg-negative-dim text-negative'
}
