'use client'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Skeleton } from './Skeleton'

interface DensityTableProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  className?: string
  skeletonRows?: number
}

export function DensityTable<T>({
  data,
  columns,
  isLoading,
  emptyMessage = 'No data',
  onRowClick,
  className,
  skeletonRows = 8,
}: DensityTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                >
                  {typeof col.header === 'string' ? col.header : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--color-border-subtle)]">
                {columns.map((_, j) => (
                  <td key={j} className="px-3 py-2">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-[var(--color-text-muted)] text-[13px]', className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-[12px] tabular-nums">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-[var(--color-border-subtle)]">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]',
                    header.column.getCanSort() && 'cursor-pointer select-none hover:text-[var(--color-text-secondary)]'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3" />}
                    {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-[var(--color-border-subtle)] transition-colors',
                onRowClick && 'cursor-pointer hover:bg-[var(--color-bg-elevated)]'
              )}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 text-[var(--color-text-primary)]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
