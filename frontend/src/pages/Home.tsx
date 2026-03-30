import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchQuote, fetchMacro, type QuoteData, type MacroData } from '../lib/api'
import { fmtPrice, fmtChangePct, fmtChange, fmtPct, changeClass, changeBgClass } from '../lib/fmt'

const MARKET_TILES = [
  { ticker: 'SPY',   label: 'S&P 500',   sub: 'via SPY' },
  { ticker: 'ISF.L', label: 'FTSE 100',  sub: 'via ISF.L' },
  { ticker: 'QQQ',   label: 'NASDAQ 100', sub: 'via QQQ' },
  { ticker: 'DIA',   label: 'Dow Jones', sub: 'via DIA' },
]

function MarketTile({ ticker, label, sub }: { ticker: string; label: string; sub: string }) {
  const [data, setData] = useState<QuoteData | null>(null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchQuote(ticker)
      .then(setData)
      .catch(() => setError(true))
  }, [ticker])

  const loading = !data && !error

  return (
    <button
      onClick={() => navigate(`/company/${ticker}`)}
      className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card hover:border-blue-500/50 hover:shadow-card-hover transition-all text-left group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
        </div>
        {data && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${changeBgClass(data.changePct)}`}>
            {fmtChangePct(data.changePct)}
          </span>
        )}
      </div>

      {loading && (
        <div className="h-8 bg-navy-700 rounded animate-pulse mt-1" />
      )}
      {error && <p className="text-sm text-slate-600 mt-1">Unavailable</p>}
      {data && (
        <>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">
            {fmtPrice(data.price)}
          </p>
          <p className={`text-sm mt-0.5 tabular-nums ${changeClass(data.change)}`}>
            {fmtChange(data.change)}
          </p>
        </>
      )}
    </button>
  )
}

function MacroRow({ label, value, suffix = '' }: { label: string; value: number | null | undefined; suffix?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-navy-700 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-100 tabular-nums">
        {value != null ? `${value}${suffix}` : '—'}
      </span>
    </div>
  )
}

export default function Home() {
  const [macro, setMacro] = useState<MacroData>({})
  const [macroLoading, setMacroLoading] = useState(true)

  useEffect(() => {
    fetchMacro()
      .then(setMacro)
      .catch(() => {})
      .finally(() => setMacroLoading(false))
  }, [])

  const yieldCurveColor =
    macro.yieldCurve === 'Normal' ? 'text-green-400' :
    macro.yieldCurve === 'Inverted' ? 'text-red-400' :
    'text-yellow-400'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page title */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">Markets</h1>
        <p className="text-sm text-slate-500 mt-0.5">Live market overview</p>
      </div>

      {/* Market tiles */}
      <section>
        <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 pl-1 border-l-2 border-blue-500">
          Indices
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MARKET_TILES.map(t => (
            <MarketTile key={t.ticker} {...t} />
          ))}
        </div>
      </section>

      {/* Macro data */}
      <section className="grid md:grid-cols-2 gap-4">
        {/* US Macro */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 shadow-card">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 border-l-2 border-blue-500 pl-2">
            US Macro
          </h2>
          {macroLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-9 bg-navy-700 rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              <MacroRow label="Fed Funds Rate" value={macro.fedRate} suffix="%" />
              <MacroRow label="CPI (YoY)" value={macro.cpiUs} suffix="%" />
              <MacroRow label="10Y Treasury" value={macro.yield10y} suffix="%" />
              <MacroRow label="2Y Treasury" value={macro.yield2y} suffix="%" />
              <MacroRow label="VIX" value={macro.vix} />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-400">Yield Curve</span>
                <span className={`text-sm font-semibold ${yieldCurveColor}`}>
                  {macro.yieldCurve ?? '—'}
                  {macro.yieldSpread != null && (
                    <span className="text-slate-500 font-normal ml-1">
                      ({macro.yieldSpread > 0 ? '+' : ''}{macro.yieldSpread?.toFixed(2)}%)
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        {/* UK Macro */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 shadow-card">
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 border-l-2 border-blue-500 pl-2">
            UK Macro
          </h2>
          {macroLoading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-9 bg-navy-700 rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              <MacroRow label="BOE Base Rate" value={macro.boeRate} suffix="%" />
              <MacroRow label="CPIH (YoY)" value={macro.ukCpi} suffix="%" />
              <MacroRow label="GDP (YoY)" value={macro.ukGdp} suffix="%" />
            </>
          )}
        </div>
      </section>
    </div>
  )
}
