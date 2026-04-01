import { cn, changeColor, formatChange } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  changePct?: number
  subtext?: string
  className?: string
  valueClassName?: string
}

export function StatCard({
  label,
  value,
  change,
  changePct,
  subtext,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-slate-100 shadow-sm p-4', className)}>
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-[22px] font-semibold text-slate-900 tabular-nums leading-tight', valueClassName)}>
        {value}
      </p>
      {(change !== undefined || changePct !== undefined) && (
        <p className={cn('text-[12px] font-medium mt-1 tabular-nums', changeColor(changePct ?? change ?? 0))}>
          {change !== undefined && (change > 0 ? '+' : '')}{typeof change === 'number' ? change.toFixed(2) : change}
          {changePct !== undefined && ` (${formatChange(changePct)})`}
        </p>
      )}
      {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  )
}
