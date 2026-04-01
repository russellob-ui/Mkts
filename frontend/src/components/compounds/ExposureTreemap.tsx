'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { Exposure } from '@/types/portfolio'
import { useState } from 'react'

interface ExposureTreemapProps {
  data: Exposure[]
  title?: string
  height?: number
}

const COLORS = [
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#64748B', // slate
]

interface TreemapContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  value: number
  index: number
}

function TreemapContent({ x, y, width, height, name, value, index }: TreemapContentProps) {
  if (width < 40 || height < 25) return null

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={COLORS[index % COLORS.length]}
        fillOpacity={0.85}
        stroke="var(--color-bg-base)"
        strokeWidth={2}
        rx={4}
      />
      {width > 50 && height > 30 && (
        <>
          <text
            x={x + 6}
            y={y + 14}
            fill="#fff"
            fontSize={11}
            fontWeight={600}
            fontFamily="Inter, system-ui"
          >
            {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '...' : name}
          </text>
          <text
            x={x + 6}
            y={y + 27}
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
            fontFamily="Inter, system-ui"
          >
            {value.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  )
}

export function ExposureTreemap({ data, title, height = 220 }: ExposureTreemapProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-[var(--color-text-muted)]"
        style={{ height }}
      >
        No exposure data
      </div>
    )
  }

  const treemapData = data
    .filter((d) => d.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((d) => ({
      name: d.label,
      value: d.weight,
    }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={treemapData}
        dataKey="value"
        nameKey="name"
        content={<TreemapContent x={0} y={0} width={0} height={0} name="" value={0} index={0} />}
      >
        <Tooltip
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null
            const item = payload[0].payload
            return (
              <div className="bg-[var(--color-bg-overlay)] border border-[var(--color-border-default)] rounded px-2 py-1 text-[11px] shadow-lg">
                <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
                <span className="ml-2 text-[var(--color-text-secondary)] tabular-nums">{item.value.toFixed(1)}%</span>
              </div>
            )
          }}
        />
      </Treemap>
    </ResponsiveContainer>
  )
}
