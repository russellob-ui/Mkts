import { useEffect, useState } from 'react'
import { getAlerts, saveAlerts, fetchQuote, type Alert } from '../lib/api'
import { fmtPrice } from '../lib/fmt'

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [ticker, setTicker] = useState('')
  const [condition, setCondition] = useState<'above' | 'below'>('above')
  const [price, setPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  useEffect(() => {
    getAlerts().then(setAlerts)
  }, [])

  async function lookupPrice() {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setLookupLoading(true)
    try {
      const q = await fetchQuote(t)
      setCurrentPrice(q.price)
    } catch {
      setCurrentPrice(null)
    } finally {
      setLookupLoading(false)
    }
  }

  async function addAlert() {
    const t = ticker.trim().toUpperCase()
    const p = parseFloat(price)
    if (!t || isNaN(p) || p <= 0) return
    const updated = [...alerts, { ticker: t, alertType: condition, value: p }]
    setAlerts(updated)
    await saveAlerts(updated)
    setTicker('')
    setPrice('')
    setCurrentPrice(null)
  }

  async function deleteAlert(i: number) {
    const updated = alerts.filter((_, idx) => idx !== i)
    setAlerts(updated)
    await saveAlerts(updated)
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Price Alerts</h1>
        <p className="text-sm text-slate-500 mt-0.5">Get notified when a stock hits your target</p>
      </div>

      {/* Create alert form */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 shadow-card space-y-4">
        <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest border-l-2 border-blue-500 pl-2">
          New Alert
        </h2>

        <div className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={e => { setTicker(e.target.value); setCurrentPrice(null) }}
            onBlur={lookupPrice}
            placeholder="Ticker (e.g. AAPL)"
            className="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
          />
          {lookupLoading && (
            <div className="self-center w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {currentPrice != null && (
            <span className="self-center text-xs text-slate-400 whitespace-nowrap">
              Now: <span className="text-slate-200 font-semibold">{fmtPrice(currentPrice)}</span>
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={condition}
            onChange={e => setCondition(e.target.value as 'above' | 'below')}
            className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 transition-all"
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Target price"
            className="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
          />
          <button
            onClick={addAlert}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <div className="text-center py-10 text-slate-600">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-sm">No alerts set. Add one above.</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-card">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3.5
                ${i < alerts.length - 1 ? 'border-b border-navy-700/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-200">{a.ticker}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                  ${a.alertType === 'above'
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-red-500/15 text-red-400'
                  }`}>
                  {a.alertType}
                </span>
                <span className="text-sm tabular-nums text-slate-300">{fmtPrice(a.value)}</span>
              </div>
              <button
                onClick={() => deleteAlert(i)}
                className="text-slate-600 hover:text-red-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
