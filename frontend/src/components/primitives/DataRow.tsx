'use client'
import { cn } from '@/lib/utils'

interface DataRowProps {
  label: string
  value: React.ReactNode
  className?: string
}

export function DataRow({ label, value, className }: DataRowProps) {
  return (
    <div className={cn('flex items-center justify-between py-1.5', className)}>
      <span className="text-[12px] text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-[12px] font-medium text-[var(--color-text-primary)] tabular-nums">
        {value}
      </span>
    </div>
  )
}
