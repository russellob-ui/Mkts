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
  // Search returns { success, results: [...] } — unwrap to just the array
  search: async (q: string): Promise<SearchResult[]> => {
    const resp = await apiFetch<any>(`/api/search?q=${encodeURIComponent(q)}`)
    return resp?.results ?? resp ?? []
  },
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
  watchlist: async (): Promise<string[]> => {
    try {
      const resp = await apiFetch<any>('/api/db/watchlist')
      // Backend may return { tickers: [...] } or just [...]
      return Array.isArray(resp) ? resp : resp?.tickers ?? []
    } catch {
      return []
    }
  },
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
  alerts: async (): Promise<unknown[]> => {
    try {
      const resp = await apiFetch<any>('/api/db/alerts')
      return Array.isArray(resp) ? resp : resp?.alerts ?? []
    } catch {
      return []
    }
  },
  alertCreate: (alert: { ticker: string; alert_type: string; value: number }) =>
    apiFetch<unknown>('/api/db/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    }),
  alertDelete: (id: number) =>
    apiFetch<unknown>(`/api/db/alerts/${id}`, { method: 'DELETE' }),
  alertsCheck: (tickers: string) =>
    apiFetch<unknown>(`/api/alerts/check?tickers=${encodeURIComponent(tickers)}`),

  // News — requires ticker param, backend returns 400 without it
  news: async (ticker?: string): Promise<NewsArticle[]> => {
    if (!ticker) return [] // Backend requires ticker
    try {
      const resp = await apiFetch<any>(
        `/api/news?ticker=${encodeURIComponent(ticker)}`
      )
      return resp?.articles ?? (Array.isArray(resp) ? resp : [])
    } catch {
      return []
    }
  },

  // Markets
  markets: async (): Promise<MarketItem[]> => {
    try {
      const resp = await apiFetch<any>('/api/markets')
      return resp?.items ?? (Array.isArray(resp) ? resp : [])
    } catch {
      return []
    }
  },
  marketMonitor: async (): Promise<MonitorItem[]> => {
    try {
      const resp = await apiFetch<any>('/api/market-monitor')
      return resp?.items ?? (Array.isArray(resp) ? resp : [])
    } catch {
      return []
    }
  },

  // Macro — correct path is /api/macro/snapshot
  macro: async (): Promise<unknown> => {
    try {
      return await apiFetch<unknown>('/api/macro/snapshot')
    } catch {
      return null
    }
  },

  // AI Brief — requires ticker, returns 400 without it
  brief: async (ticker?: string, mode?: 'concise' | 'analyst'): Promise<Brief | null> => {
    if (!ticker) return null // Backend requires ticker
    try {
      const resp = await apiFetch<any>(
        `/api/brief?ticker=${encodeURIComponent(ticker)}${mode ? `&mode=${mode}` : ''}`
      )
      return resp
    } catch {
      return null
    }
  },

  // Home (company + events + performance)
  home: (ticker: string) =>
    apiFetch<unknown>(`/api/home?ticker=${encodeURIComponent(ticker)}`),
}
