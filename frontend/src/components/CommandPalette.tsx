'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { useUIStore } from '@/stores/uiStore'
import { useSearchQuery } from '@/hooks/queries/useSearchQuery'
import {
  Search, Activity, Briefcase, Globe, Settings,
  Sun, Moon, Search as SearchIcon
} from 'lucide-react'

const spaces = [
  { label: 'Monitor', href: '/', icon: Activity, space: 'monitor' as const },
  { label: 'Portfolio', href: '/portfolio', icon: Briefcase, space: 'portfolio' as const },
  { label: 'Research', href: '/research', icon: SearchIcon, space: 'research' as const },
  { label: 'Macro', href: '/macro', icon: Globe, space: 'macro' as const },
  { label: 'Settings', href: '/settings', icon: Settings, space: null },
]

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveTicker, setActiveSpace, toggleTheme, theme } = useUIStore()
  const [query, setQuery] = useState('')
  const router = useRouter()

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: searchResults, isLoading: searching } = useSearchQuery(debouncedQuery)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  if (!commandPaletteOpen) return null

  const navigate = (href: string) => {
    router.push(href)
    setCommandPaletteOpen(false)
    setQuery('')
  }

  const goToTicker = (ticker: string) => {
    const symbol = ticker.trim().toUpperCase()
    if (!symbol) return
    setActiveTicker(symbol)
    setActiveSpace('research')
    navigate(`/research/${encodeURIComponent(symbol)}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />
      <div className="relative w-full max-w-lg bg-[var(--color-bg-overlay)] rounded-xl shadow-2xl border border-[var(--color-border-default)] overflow-hidden">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b border-[var(--color-border-subtle)] px-4 gap-3">
            <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
            <Command.Input
              className="flex-1 py-3.5 text-[13px] outline-none placeholder:text-[var(--color-text-muted)] bg-transparent text-[var(--color-text-primary)]"
              placeholder="Search ticker or navigate..."
              value={query}
              onValueChange={setQuery}
              autoFocus
            />
            <kbd className="text-[10px] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            {/* Live search results */}
            {debouncedQuery.length >= 1 && searchResults && searchResults.length > 0 && (
              <Command.Group heading="Tickers" className="px-2">
                {searchResults.slice(0, 8).map((result) => (
                  <Command.Item
                    key={result.symbol}
                    value={result.symbol}
                    onSelect={() => goToTicker(result.symbol)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] cursor-pointer text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] aria-selected:bg-[var(--color-accent-dim)] aria-selected:text-[var(--color-accent-bright)]"
                  >
                    <span className="font-mono font-semibold text-[var(--color-accent-bright)] w-16">
                      {result.symbol}
                    </span>
                    <span className="text-[var(--color-text-secondary)] truncate flex-1">
                      {result.description}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {result.type}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Searching indicator */}
            {debouncedQuery.length >= 1 && searching && (
              <div className="px-5 py-3 text-[12px] text-[var(--color-text-muted)]">
                Searching...
              </div>
            )}

            {/* Fallback: manual ticker lookup */}
            {query.length >= 1 && (!searchResults || searchResults.length === 0) && !searching && (
              <Command.Group heading="Ticker" className="px-2">
                <Command.Item
                  onSelect={() => goToTicker(query)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] cursor-pointer text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] aria-selected:bg-[var(--color-accent-dim)]"
                >
                  <Search size={13} className="text-[var(--color-accent)]" />
                  Look up <strong className="text-[var(--color-accent-bright)]">{query.toUpperCase()}</strong>
                </Command.Item>
              </Command.Group>
            )}

            {/* Navigate */}
            <Command.Group heading="Navigate" className="px-2">
              {spaces.map(({ label, href, icon: Icon, space }) => (
                <Command.Item
                  key={href}
                  value={label}
                  onSelect={() => {
                    if (space) setActiveSpace(space)
                    navigate(href)
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] cursor-pointer text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] aria-selected:bg-[var(--color-accent-dim)] aria-selected:text-[var(--color-accent-bright)]"
                >
                  <Icon size={13} className="text-[var(--color-text-muted)]" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Actions" className="px-2">
              <Command.Item
                value="Toggle theme"
                onSelect={() => {
                  toggleTheme()
                  setCommandPaletteOpen(false)
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] cursor-pointer text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] aria-selected:bg-[var(--color-accent-dim)]"
              >
                {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                Toggle {theme === 'dark' ? 'light' : 'dark'} mode
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
