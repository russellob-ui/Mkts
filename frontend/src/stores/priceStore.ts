import { create } from 'zustand'
import type { PriceTick } from '@/types/ws'

interface PriceStore {
  prices: Record<string, PriceTick>
  previousCloses: Record<string, number>
  connected: boolean

  setConnected: (connected: boolean) => void
  setPreviousClose: (ticker: string, close: number) => void
  updatePrice: (tick: PriceTick) => void
  getPrice: (ticker: string) => PriceTick | undefined
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  previousCloses: {},
  connected: false,

  setConnected: (connected) => set({ connected }),

  setPreviousClose: (ticker, close) =>
    set((state) => ({
      previousCloses: { ...state.previousCloses, [ticker]: close },
    })),

  updatePrice: (tick) =>
    set((state) => ({
      prices: { ...state.prices, [tick.ticker]: tick },
    })),

  getPrice: (ticker) => get().prices[ticker],
}))
