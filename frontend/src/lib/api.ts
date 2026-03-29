/** API client — all calls go to /api/* on the same origin */

const SESSION_KEY = 'mkts_session_id'

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { 'X-Session-Id': getSessionId() },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': getSessionId(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { 'X-Session-Id': getSessionId() },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuoteData {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  currency: string
  marketState?: string
}

export interface CompanyData extends QuoteData {
  marketCap?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  volume?: number
  averageVolume?: number
  open?: number
  dayHigh?: number
  dayLow?: number
  previousClose?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  sector?: string
  industry?: string
  country?: string
  website?: string
  longBusinessSummary?: string
}

export interface MacroData {
  fedRate?: number
  boeRate?: number
  cpiUs?: number
  ukCpi?: number
  ukGdp?: number
  yield10y?: number
  yield2y?: number
  yieldSpread?: number
  yieldCurve?: string
  vix?: number
  hasData?: boolean
}

export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

export interface Holding {
  name: string
  ticker: string
  isin: string
  quantity?: number
  unitPrice?: number
  valueGbp?: number
  costGbp?: number
  unrealisedGl?: number
  unrealisedGlPct?: number
  currency: string
  assetClass: string
  weightPct?: number
  resolved: boolean
}

export interface PortfolioResult {
  success: boolean
  formatDetected: string
  totalHoldings: number
  resolvedCount: number
  totalValueGbp: number
  totalCostGbp: number
  holdings: Holding[]
  parseErrors: string[]
}

export interface Alert {
  id?: number
  ticker: string
  alertType: string  // "above" | "below"
  value: number
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  const res = await get<{ success: boolean; data: QuoteData; error?: string }>(`/api/quote?ticker=${encodeURIComponent(ticker)}`)
  if (!res.success) throw new Error(res.error || 'Quote unavailable')
  return res.data
}

export async function fetchCompany(ticker: string): Promise<CompanyData> {
  const res = await get<{ success: boolean; data: CompanyData; error?: string }>(`/api/company?ticker=${encodeURIComponent(ticker)}`)
  if (!res.success) throw new Error(res.error || 'Company data unavailable')
  return res.data
}

export async function fetchMacro(): Promise<MacroData> {
  const res = await get<{ success: boolean; data: MacroData }>('/api/macro/snapshot')
  return res.data || {}
}

export async function fetchSearch(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return []
  const res = await get<{ success: boolean; results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`)
  return res.results || []
}

export async function uploadPortfolio(file: File): Promise<PortfolioResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('save', 'true')
  const res = await fetch('/api/portfolio/import', {
    method: 'POST',
    headers: { 'X-Session-Id': getSessionId() },
    body: form,
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.error || `Upload failed: HTTP ${res.status}`)
  }
  return res.json()
}

// Watchlist (persisted in DB)
export async function getWatchlist(): Promise<string[]> {
  const res = await get<{ success: boolean; data: string[] }>('/api/db/watchlist')
  return res.data || []
}

export async function saveWatchlist(tickers: string[]): Promise<void> {
  await post('/api/db/watchlist', { tickers })
}

// Alerts (persisted in DB)
export async function getAlerts(): Promise<Alert[]> {
  const res = await get<{ success: boolean; data: Alert[] }>('/api/db/alerts')
  return res.data || []
}

export async function saveAlerts(alerts: Alert[]): Promise<void> {
  await post('/api/db/alerts', { alerts })
}

export { del }
