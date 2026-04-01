'use client'
import { Bell, Sun, Moon, Command } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { StatusDot } from '@/components/primitives/StatusDot'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { sidebarCollapsed, toggleCommandPalette, theme, toggleTheme, setAlertPanelOpen } = useUIStore()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-11 bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border-subtle)]',
        'flex items-center justify-between px-4 z-20 transition-all duration-200',
        'left-0 md:left-48',
        sidebarCollapsed && 'md:left-12'
      )}
    >
      {/* Search trigger */}
      <button
        onClick={toggleCommandPalette}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--color-border-default)] text-[var(--color-text-muted)] text-[12px] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)] transition-all w-52 md:w-64"
      >
        <Command size={12} />
        <span className="truncate">Search tickers, navigate...</span>
        <kbd className="ml-auto text-[10px] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)] hidden md:block">
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <StatusDot />
        <button
          onClick={() => setAlertPanelOpen(true)}
          className="relative p-1.5 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] transition-colors"
        >
          <Bell size={15} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full" />
        </button>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  )
}
