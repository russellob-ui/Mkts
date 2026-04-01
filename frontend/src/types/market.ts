export interface Quote {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  currency: 'GBP' | 'GBX' | 'USD' | 'EUR' | string
  marketState: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | null
}

export interface CompanyDetail extends Quote {
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  dividendYield: number | null
  volume: number | null
  averageVolume: number | null
  open: number | null
  dayHigh: number | null
  dayLow: number | null
  previousClose: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  sector: string | null
  industry: string | null
  country: string | null
  website: string | null
  longBusinessSummary: string | null
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartEvent {
  time: string
  type: 'earnings' | 'dividend' | 'split' | string
  value: number | null
  label: string | null
}

export interface ChartResponse {
  candles: Candle[]
  events: ChartEvent[]
}

export interface MarketItem {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePct: number | null
}

export interface MonitorItem extends MarketItem {
  dayChangePct: number | null
  weekChangePct: number | null
  monthChangePct: number | null
}

export interface SearchResult {
  symbol: string
  name: string
  description?: string
  type: string
  exchange?: string
}

export type ChartPeriod = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '3y' | '5y'
