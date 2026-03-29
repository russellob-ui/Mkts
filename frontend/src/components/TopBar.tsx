import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSearch, type SearchResult } from '../lib/api'

export default function TopBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetchSearch(query)
        setResults(r)
        setOpen(r.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  function go(ticker?: string) {
    const t = (ticker || query).trim().toUpperCase()
    if (!t) return
    setQuery('')
    setResults([])
    setOpen(false)
    navigate(`/company/${t}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-navy-900 border-b border-navy-800 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-3 px-4 md:px-6 h-14">
        {/* Logo */}
        <a href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-lg font-bold tracking-tight text-white">MKTS</span>
          <span className="text-blue-500 text-lg font-bold">/</span>
        </a>

        {/* Search */}
        <div className="relative flex-1 max-w-lg">
          <div className="flex items-center bg-navy-800 border border-navy-700 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
            <svg className="w-4 h-4 ml-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && go()}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Ticker or company name…"
              className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
            />
            {loading && (
              <div className="mr-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={() => go()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2.5 transition-colors"
            >
              GO
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-card overflow-hidden z-50">
              {results.map(r => (
                <button
                  key={r.symbol}
                  onMouseDown={() => go(r.symbol)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-navy-700 text-left transition-colors"
                >
                  <span className="text-sm font-semibold text-blue-400 w-20 shrink-0">{r.symbol}</span>
                  <span className="text-sm text-slate-300 truncate">{r.name}</span>
                  <span className="ml-auto text-xs text-slate-500 shrink-0">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
