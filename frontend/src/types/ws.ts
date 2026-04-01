export interface PriceTick {
  ticker: string
  price: number
  change: number
  changePct: number
  volume: number | undefined
  timestamp: number
}
