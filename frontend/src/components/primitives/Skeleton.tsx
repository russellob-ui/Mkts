'use client'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[var(--color-bg-elevated)]',
        className
      )}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-[var(--color-border-subtle)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
