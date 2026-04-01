import type { CompanyDetail, Quote, ChartResponse, MonitorItem, MarketItem, SearchResult, ChartPeriod } from '@/types/market'
import type { Portfolio, ImportResult } from '@/types/portfolio'
import type { Financials } from '@/types/financials'
import type { NewsArticle } from '@/types/news'
import type { Brief } from '@/types/ai'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

function getSessionId(): string {
  if (typeof window === 'undefined') return 'default'
  let sid = localStorage.getItem('mkts_session_id')
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem('mkts_session_id', sid)
  }
  return sid
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': getSessionId(),
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  const data = await res.json()
  return data.data ?? data
}

export const api = {
  // Market data
  quote: (ticker: string) =>
    apiFetch<Quote>(`/api/quote?ticker=${encodeURIComponent(ticker)}`),
  company: (ticker: string) =>
    apiFetch<CompanyDetail>(`/api/company?ticker=${encodeURIComponent(ticker)}`),
  search: (q: string) =>
    apiFetch<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  charts: (ticker: string, period: ChartPeriod = '1y') =>
    apiFetch<ChartResponse>(`/api/charts?ticker=${encodeURIComponent(ticker)}&period=${period}`),
  financials: (ticker: string) =>
    apiFetch<Financials>(`/api/financials?ticker=${encodeURIComponent(ticker)}`),
  peers: (ticker: string) =>
    apiFetch<CompanyDetail[]>(`/api/peers?ticker=${encodeURIComponent(ticker)}`),
  options: (ticker: string) =>
    apiFetch<unknown>(`/api/options?ticker=${encodeURIComponent(ticker)}`),

  // Portfolio
  portfolio: () => apiFetch<Portfolio>('/api/db/portfolio'),
  portfolioAnalytics: () => apiFetch<Portfolio>('/api/portfolio/analytics'),
  portfolioImport: (formData: FormData) =>
    fetch(`${API_BASE}/api/portfolio/import`, {
      method: 'POST',
      headers: { 'X-Session-Id': getSessionId() },
      body: formData,
    }).then((r) => r.json()) as Promise<ImportResult>,

  // Watchlist
  watchlist: () => apiFetch<string[]>('/api/db/watchlist'),
  watchlistAdd: (ticker: string) =>
    apiFetch<unknown>('/api/db/watchlist', {
      method: 'POST',
      body: JSON.stringify({ ticker }),
    }),
  watchlistRemove: (ticker: string) =>
    apiFetch<unknown>(`/api/db/watchlist/${encodeURIComponent(ticker)}`, {
      method: 'DELETE',
    }),

  // Alerts
  alerts: () => apiFetch<unknown[]>('/api/db/alerts'),
  alertCreate: (alert: { ticker: string; alert_type: string; value: number }) =>
    apiFetch<unknown>('/api/db/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    }),
  alertDelete: (id: number) =>
    apiFetch<unknown>(`/api/db/alerts/${id}`, { method: 'DELETE' }),
  alertsCheck: (tickers: string) =>
    apiFetch<unknown>(`/api/alerts/check?tickers=${encodeURIComponent(tickers)}`),

  // News
  news: (ticker?: string) =>
    apiFetch<NewsArticle[]>(
      `/api/news${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}`
    ),

  // Markets
  markets: () => apiFetch<MarketItem[]>('/api/markets'),
  marketMonitor: () => apiFetch<MonitorItem[]>('/api/market-monitor'),

  // Macro
  macro: () => apiFetch<unknown>('/api/macro'),

  // AI
  brief: (ticker?: string, mode?: 'concise' | 'analyst') =>
    apiFetch<Brief>(
      `/api/brief${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}${mode ? `${ticker ? '&' : '?'}mode=${mode}` : ''}`
    ),

  // Home (company + events + performance)
  home: (ticker: string) =>
    apiFetch<unknown>(`/api/home?ticker=${encodeURIComponent(ticker)}`),
}
