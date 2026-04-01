'use client'
import type { Brief } from '@/types/ai'
import { Skeleton } from '@/components/primitives/Skeleton'
import { BrainCircuit, RefreshCw } from 'lucide-react'

interface BriefPanelProps {
  brief: Brief | null | undefined
  isLoading?: boolean
  onRefresh?: () => void
}

export function BriefPanel({ brief, isLoading, onRefresh }: BriefPanelProps) {
  if (isLoading) {
    return (
      <div className="px-3 py-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="flex items-center justify-center py-6 text-[12px] text-[var(--color-text-muted)]">
        No brief available
      </div>
    )
  }

  return (
    <div className="px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BrainCircuit size={12} className="text-[var(--color-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            AI Brief
          </span>
        </div>
        <div className="flex items-center gap-2">
          {brief.generatedAt && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {new Date(brief.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-0.5 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Bullets */}
      {brief.bullets && brief.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {brief.bullets.map((bullet, i) => (
            <li
              key={i}
              className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed pl-3 border-l-2 border-[var(--color-accent-dim)]"
            >
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Sections (analyst mode) */}
      {brief.sections && brief.sections.length > 0 && (
        <div className="mt-3 space-y-3">
          {brief.sections.map((section, i) => (
            <div key={i}>
              <h4 className="text-[11px] font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-1">
                {section.heading}
              </h4>
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
