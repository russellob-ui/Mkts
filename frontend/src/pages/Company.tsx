import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCompany, type CompanyData } from '../lib/api'
import {
  fmtPrice, fmtChange, fmtChangePct, fmtMarketCap,
  fmtVolume, fmtPct, changeClass, changeBgClass,
} from '../lib/fmt'
import TVChart from '../components/TVChart'
import StatCard from '../components/StatCard'

export default function Company() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setData(null)
    fetchCompany(ticker)
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [ticker])

  if (!ticker) return null

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pt-2">
        <div className="h-24 bg-navy-800 rounded-xl animate-pulse" />
        <div className="h-96 bg-navy-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-20 bg-navy-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto pt-8 text-center">
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-8 inline-block">
          <svg className="w-10 h-10 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-semibold text-red-400">Ticker not found</p>
          <p className="text-sm text-slate-500 mt-1">{ticker.toUpperCase()} — {error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const isPositive = data.change >= 0
  const divYieldPct = data.dividendYield != null
    ? `${(data.dividendYield * 100).toFixed(2)}%`
    : '—'

  return (
    <div className="max-w-4xl mx-auto space-y-5 pt-2">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-slate-300 transition-colors">Home</button>
        <span>/</span>
        <span className="text-slate-300">{data.ticker}</span>
      </div>

      {/* Price hero */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-100">{data.ticker}</h1>
              {data.country && (
                <span className="text-xs font-medium bg-navy-700 text-slate-400 px-2 py-0.5 rounded-full">
                  {data.country}
                </span>
              )}
              <span className="text-xs font-medium bg-navy-700 text-slate-400 px-2 py-0.5 rounded-full">
                {data.currency}
              </span>
            </div>
            <p className="text-slate-400 text-sm">{data.name}</p>
            {data.sector && (
              <p className="text-xs text-slate-500 mt-0.5">{data.sector}{data.industry ? ` · ${data.industry}` : ''}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold tabular-nums text-slate-100">{fmtPrice(data.price)}</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className={`text-base font-semibold tabular-nums ${changeClass(data.change)}`}>
                {fmtChange(data.change)}
              </span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${changeBgClass(data.changePct)}`}>
                {fmtChangePct(data.changePct)}
              </span>
            </div>
            {data.previousClose != null && (
              <p className="text-xs text-slate-500 mt-0.5">Prev close: {fmtPrice(data.previousClose)}</p>
            )}
          </div>
        </div>
      </div>

      {/* TradingView chart */}
      <TVChart ticker={ticker} height={420} />

      {/* Stats grid */}
      <section>
        <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 border-l-2 border-blue-500 pl-2">
          Key Statistics
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
          <StatCard label="Open"      value={fmtPrice(data.open)} />
          <StatCard label="Day High"  value={fmtPrice(data.dayHigh)} positive={!!data.dayHigh} />
          <StatCard label="Day Low"   value={fmtPrice(data.dayLow)}  negative={!!data.dayLow} />
          <StatCard label="Prev Close" value={fmtPrice(data.previousClose)} />
          <StatCard label="Volume"    value={fmtVolume(data.volume)} />
          <StatCard label="Avg Vol"   value={fmtVolume(data.averageVolume)} />
          <StatCard label="Mkt Cap"   value={fmtMarketCap(data.marketCap)} accent={!!data.marketCap} />
          <StatCard label="P/E (TTM)" value={data.trailingPE != null ? data.trailingPE.toFixed(1) : '—'} accent={!!data.trailingPE} />
          <StatCard label="Div Yield" value={divYieldPct} accent={!!data.dividendYield} />
          <StatCard label="52W High"  value={fmtPrice(data.fiftyTwoWeekHigh)} />
          <StatCard label="52W Low"   value={fmtPrice(data.fiftyTwoWeekLow)} />
          <StatCard label="Fwd P/E"   value={data.forwardPE != null ? data.forwardPE.toFixed(1) : '—'} />
        </div>
      </section>

      {/* Company description */}
      {data.longBusinessSummary && (
        <section className="bg-navy-800 border border-navy-700 rounded-xl p-5 shadow-card">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 border-l-2 border-blue-500 pl-2">
            About
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-6">{data.longBusinessSummary}</p>
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 transition-colors"
            >
              {data.website.replace(/^https?:\/\//, '')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </section>
      )}
    </div>
  )
}
