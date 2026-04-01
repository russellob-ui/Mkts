'use client'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DensityTable } from '@/components/primitives/DensityTable'
import { Ticker } from '@/components/primitives/Ticker'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import type { CompanyDetail } from '@/types/market'

interface PeerTableProps {
  peers: CompanyDetail[]
  isLoading?: boolean
}

export function PeerTable({ peers, isLoading }: PeerTableProps) {
  const columns = useMemo<ColumnDef<CompanyDetail, any>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: 'Symbol',
        cell: ({ getValue }) => <Ticker symbol={getValue()} />,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)] truncate max-w-[140px] block text-[11px]">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => (
          <CurrencyValue value={row.original.price} currency={row.original.currency} />
        ),
      },
      {
        accessorKey: 'changePct',
        header: 'Change',
        cell: ({ getValue }) => <ChangeCell value={getValue()} />,
      },
      {
        accessorKey: 'trailingPE',
        header: 'P/E',
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return <span className="tabular-nums">{v?.toFixed(1) ?? '—'}</span>
        },
      },
      {
        accessorKey: 'dividendYield',
        header: 'Yield',
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return <span className="tabular-nums">{v != null ? `${v.toFixed(2)}%` : '—'}</span>
        },
      },
      {
        accessorKey: 'marketCap',
        header: 'Mkt Cap',
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          if (v == null) return '—'
          if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
          if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
          return v.toLocaleString()
        },
      },
    ],
    []
  )

  return (
    <DensityTable
      data={peers}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="No peers found"
      skeletonRows={5}
    />
  )
}
