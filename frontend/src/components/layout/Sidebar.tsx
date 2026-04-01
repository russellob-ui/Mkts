'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity, Briefcase, Search as SearchIcon, Globe,
  Settings, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, type Space } from '@/stores/uiStore'

const spaceItems: Array<{ href: string; label: string; icon: typeof Activity; space: Space }> = [
  { href: '/', label: 'Monitor', icon: Activity, space: 'monitor' },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase, space: 'portfolio' },
  { href: '/research', label: 'Research', icon: SearchIcon, space: 'research' },
  { href: '/macro', label: 'Macro', icon: Globe, space: 'macro' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, setActiveSpace } = useUIStore()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)]',
        'flex flex-col transition-all duration-200 z-30 hidden md:flex',
        sidebarCollapsed ? 'w-12' : 'w-48'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-11 border-b border-[var(--color-border-subtle)] px-3 shrink-0',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!sidebarCollapsed && (
          <span className="text-[14px] font-bold text-[var(--color-accent-bright)] tracking-tight">
            MKTS
          </span>
        )}
        {sidebarCollapsed && (
          <span className="text-[14px] font-bold text-[var(--color-accent-bright)]">M</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Spaces */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <div className={cn('px-3 mb-1', sidebarCollapsed && 'px-1')}>
          {!sidebarCollapsed && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-2">
              Spaces
            </span>
          )}
        </div>
        {spaceItems.map(({ href, label, icon: Icon, space }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              onClick={() => setActiveSpace(space)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 mx-1.5 rounded text-[12px] font-medium transition-colors',
                sidebarCollapsed && 'justify-center mx-1 px-0',
                active
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-bright)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Icon size={15} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-3 mx-3 border-t border-[var(--color-border-subtle)]" />

        {/* Settings */}
        <Link
          href="/settings"
          title={sidebarCollapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 mx-1.5 rounded text-[12px] font-medium transition-colors',
            sidebarCollapsed && 'justify-center mx-1 px-0',
            pathname === '/settings'
              ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent-bright)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
          )}
        >
          <Settings size={15} className="shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2.5 border-t border-[var(--color-border-subtle)] shrink-0">
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">MKTS v6.0</span>
        </div>
      )}
    </aside>
  )
}
