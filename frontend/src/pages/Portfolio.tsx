import { useState, useRef } from 'react'
import { uploadPortfolio, type Holding, type PortfolioResult } from '../lib/api'
import { fmtGbp, fmtPct, changeClass } from '../lib/fmt'

function GlBadge({ v }: { v: number | undefined | null }) {
  if (v == null) return <span className="text-slate-500">—</span>
  const cls = v >= 0 ? 'text-green-400' : 'text-red-400'
  return <span className={cls}>{v >= 0 ? '+' : ''}{fmtGbp(v)}</span>
}

function GlPctBadge({ v }: { v: number | undefined | null }) {
  if (v == null) return <span className="text-slate-500">—</span>
  const cls = v >= 0 ? 'text-green-400' : 'text-red-400'
  return <span className={cls}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
}

export default function Portfolio() {
  const [result, setResult] = useState<PortfolioResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const r = await uploadPortfolio(file)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const gl = result ? result.totalValueGbp - result.totalCostGbp : null
  const glPct = result && result.totalCostGbp > 0 ? (gl! / result.totalCostGbp) * 100 : null

  return (
    <div className="max-w-5xl mx-auto space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Portfolio</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload a CSV or Excel export from your broker</p>
      </div>

      {/* Upload zone */}
      {!result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
            ${dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-navy-700 hover:border-blue-500/50 bg-navy-800/50'
            }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Parsing holdings…</p>
            </div>
          ) : (
            <>
              <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-base font-medium text-slate-300">Drop your portfolio file here</p>
              <p className="text-sm text-slate-500 mt-1">Supports Brewin Dolphin, Hargreaves Lansdown, Quilter, CSV</p>
              <p className="text-xs text-slate-600 mt-1">.xlsx · .xls · .csv · max 10 MB</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {result && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Value</p>
              <p className="text-lg font-bold text-slate-100">{fmtGbp(result.totalValueGbp)}</p>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Cost</p>
              <p className="text-lg font-bold text-slate-100">{fmtGbp(result.totalCostGbp)}</p>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Gain / Loss</p>
              <p className={`text-lg font-bold ${gl != null ? (gl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-400'}`}>
                {gl != null ? `${gl >= 0 ? '+' : ''}${fmtGbp(gl)}` : '—'}
              </p>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Holdings</p>
              <p className="text-lg font-bold text-slate-100">{result.totalHoldings}</p>
              <p className="text-xs text-slate-500 mt-0.5">{result.resolvedCount} resolved</p>
            </div>
          </div>

          {/* Format + reset */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Format: <span className="text-slate-400">{result.formatDetected}</span>
            </p>
            <button
              onClick={() => setResult(null)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Upload new file
            </button>
          </div>

          {/* Holdings table — desktop */}
          <div className="hidden sm:block bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">G/L</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">G/L %</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight</th>
                </tr>
              </thead>
              <tbody>
                {result.holdings.map((h, i) => (
                  <tr key={i} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200 truncate max-w-xs">{h.name}</p>
                      {h.ticker
                        ? <p className="text-xs text-blue-400 mt-0.5">{h.ticker}</p>
                        : <p className="text-xs text-slate-600 mt-0.5">{h.isin || 'unresolved'}</p>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtGbp(h.valueGbp)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtGbp(h.costGbp)}</td>
                    <td className="px-4 py-3 text-right tabular-nums"><GlBadge v={h.unrealisedGl} /></td>
                    <td className="px-4 py-3 text-right tabular-nums"><GlPctBadge v={h.unrealisedGlPct} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                      {h.weightPct != null ? `${h.weightPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Holdings cards — mobile */}
          <div className="sm:hidden space-y-2">
            {result.holdings.map((h, i) => (
              <div key={i} className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 truncate text-sm">{h.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{h.ticker || h.isin || 'unresolved'}</p>
                  </div>
                  <p className="text-base font-bold text-slate-100 ml-3">{fmtGbp(h.valueGbp)}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-slate-500">Cost: {fmtGbp(h.costGbp)}</span>
                  <GlPctBadge v={h.unrealisedGlPct} />
                  {h.weightPct != null && <span className="text-slate-500">{h.weightPct.toFixed(1)}%</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
