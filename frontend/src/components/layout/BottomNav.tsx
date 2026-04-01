'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Briefcase, Search, Globe, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import type { Space } from '@/stores/uiStore'

const tabs: Array<{ href: string; label: string; icon: typeof Activity; space: Space | null }> = [
  { href: '/', label: 'Monitor', icon: Activity, space: 'monitor' },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase, space: 'portfolio' },
  { href: '/research', label: 'Research', icon: Search, space: 'research' },
  { href: '/macro', label: 'Macro', icon: Globe, space: 'macro' },
  { href: '/settings', label: 'More', icon: MoreHorizontal, space: null },
]

export function BottomNav() {
  const pathname = usePathname()
  const setActiveSpace = useUIStore((s) => s.setActiveSpace)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex md:hidden z-30 safe-area-pb">
      {tabs.map(({ href, label, icon: Icon, space }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => space && setActiveSpace(space)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
              active ? 'text-[var(--color-accent-bright)]' : 'text-[var(--color-text-muted)]'
            )}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
