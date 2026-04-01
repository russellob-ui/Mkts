export type TaxWrapper = 'ISA' | 'SIPP' | 'GIA'

export interface Holding {
  ticker: string
  name: string
  shares: number
  price: number
  change: number
  changePct: number
  marketValue: number
  marketValueGBP: number | null
  weight: number
  dayPnL: number
  costBasis: number | null
  sector: string | null
  country: string | null
  currency: string
  account: TaxWrapper | string | null
  dividendRate: number | null
  dividendYield: number | null
}

export interface Exposure {
  label: string
  weight: number
}

export interface PortfolioConcentration {
  normalizedHHI: number
  effectivePositions: number
  top3Weight: number
}

export interface PortfolioBenchmark {
  portfolioChangePct: number
  benchmarkChangePct: number
  benchmarkName: string
}

export interface Portfolio {
  holdings: Holding[]
  totalValue: number
  totalValueGBP: number | null
  dayPnL: number
  dayPnLGBP: number | null
  dayChangePct: number
  portfolioYield: number | null
  holdingsCount: number | null
  sectorExposure: Exposure[]
  countryExposure: Exposure[]
  currencyExposure: Exposure[]
  topWinners: Holding[]
  topLosers: Holding[]
  concentration: PortfolioConcentration
  benchmark: PortfolioBenchmark
}

export interface ImportResult {
  holdings: Array<{
    ticker: string
    name: string
    shares: number
    price: number | null
    value: number | null
    account: string | null
  }>
  unresolved: Array<{ isin: string; reason: string }>
  totalValueGBP: number | null
  totalCostGBP: number | null
  formatDetected: string
  parseErrors: string[]
}
