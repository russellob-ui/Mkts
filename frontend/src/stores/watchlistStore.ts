import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WatchlistStore {
  tickers: string[]
  setTickers: (tickers: string[]) => void
  add: (ticker: string) => void
  remove: (ticker: string) => void
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set) => ({
      tickers: [],
      setTickers: (tickers) => set({ tickers }),
      add: (ticker) =>
        set((s) => ({
          tickers: s.tickers.includes(ticker) ? s.tickers : [...s.tickers, ticker],
        })),
      remove: (ticker) =>
        set((s) => ({ tickers: s.tickers.filter((t) => t !== ticker) })),
    }),
    { name: 'mkts-watchlist' }
  )
)
