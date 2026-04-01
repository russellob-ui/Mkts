'use client'
import { cn } from '@/lib/utils'

interface MiniChartProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function MiniChart({
  data,
  width = 60,
  height = 20,
  color,
  className,
}: MiniChartProps) {
  if (!data || data.length < 2) {
    return <div className={cn('inline-block', className)} style={{ width, height }} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })

  const trend = data[data.length - 1] >= data[0]
  const strokeColor = color ?? (trend ? 'var(--color-gain)' : 'var(--color-loss)')

  return (
    <svg
      width={width}
      height={height}
      className={cn('inline-block', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
