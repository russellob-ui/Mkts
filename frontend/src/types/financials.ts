export interface FinancialPeriod {
  period: string
  revenue: number | null
  grossProfit: number | null
  operatingIncome: number | null
  netIncome: number | null
  epsBasic: number | null
  totalAssets: number | null
  totalDebt: number | null
  cashAndCashEquivalents: number | null
  totalEquity: number | null
  operatingCashFlow: number | null
  capitalExpenditure: number | null
  freeCashFlow: number | null
  dividendsPaid: number | null
}

export interface FinancialAnalytics {
  operatingMargin: number | null
  netMargin: number | null
  grossMargin: number | null
  roe: number | null
  debtToEquity: number | null
  freeCashFlowMargin: number | null
  revenueGrowth: number | null
  netIncomeGrowth: number | null
}

export interface Financials {
  ticker: string
  currency: string | null
  periods: FinancialPeriod[]
  analytics: FinancialAnalytics | null
}
