import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWatchlist, saveWatchlist, fetchQuote, type QuoteData } from '../lib/api'
import { fmtPrice, fmtChange, fmtChangePct, changeClass, changeBgClass } from '../lib/fmt'

interface WatchItem {
  ticker: string
  quote: QuoteData | null
  loading: boolean
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getWatchlist().then(tickers => {
      setItems(tickers.map(t => ({ ticker: t, quote: null, loading: true })))
      tickers.forEach(t => {
        fetchQuote(t)
          .then(q => setItems(prev => prev.map(i => i.ticker === t ? { ...i, quote: q, loading: false } : i)))
          .catch(() => setItems(prev => prev.map(i => i.ticker === t ? { ...i, loading: false } : i)))
      })
    })
  }, [])

  async function addTicker() {
    const t = input.trim().toUpperCase()
    if (!t || items.some(i => i.ticker === t)) return
    const newItem: WatchItem = { ticker: t, quote: null, loading: true }
    const updated = [...items, newItem]
    setItems(updated)
    setInput('')
    await saveWatchlist(updated.map(i => i.ticker))
    fetchQuote(t)
      .then(q => setItems(prev => prev.map(i => i.ticker === t ? { ...i, quote: q, loading: false } : i)))
      .catch(() => setItems(prev => prev.map(i => i.ticker === t ? { ...i, loading: false } : i)))
  }

  async function remove(ticker: string) {
    const updated = items.filter(i => i.ticker !== ticker)
    setItems(updated)
    await saveWatchlist(updated.map(i => i.ticker))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Watchlist</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track tickers with live prices</p>
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. AAPL, CNA.L)"
          className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
        />
        <button
          onClick={addTicker}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No tickers yet. Add one above.</p>
        </div>
      )}

      {/* Ticker rows */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-card">
        {items.map((item, i) => (
          <div
            key={item.ticker}
            className={`flex items-center justify-between px-4 py-3.5 hover:bg-navy-700/40 transition-colors cursor-pointer
              ${i < items.length - 1 ? 'border-b border-navy-700/50' : ''}`}
            onClick={() => navigate(`/company/${item.ticker}`)}
          >
            <div>
              <p className="text-sm font-semibold text-slate-200">{item.ticker}</p>
              {item.quote && <p className="text-xs text-slate-500 mt-0.5">{item.quote.name}</p>}
            </div>

            <div className="flex items-center gap-3">
              {item.loading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {item.quote && (
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-100">
                    {fmtPrice(item.quote.price)}
                  </p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${changeBgClass(item.quote.changePct)}`}>
                    {fmtChangePct(item.quote.changePct)}
                  </span>
                </div>
              )}
              {!item.loading && !item.quote && (
                <span className="text-xs text-slate-600">N/A</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); remove(item.ticker) }}
                className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
