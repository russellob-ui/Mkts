'use client'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DensityTable } from '@/components/primitives/DensityTable'
import { Ticker } from '@/components/primitives/Ticker'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Badge } from '@/components/primitives/Badge'
import { usePriceStore } from '@/stores/priceStore'
import type { Holding, TaxWrapper } from '@/types/portfolio'

interface HoldingsTableProps {
  holdings: Holding[]
  isLoading?: boolean
}

const wrapperVariant = (account: string | null): 'accent' | 'warn' | 'default' => {
  switch (account) {
    case 'ISA': return 'accent'
    case 'SIPP': return 'warn'
    default: return 'default'
  }
}

export function HoldingsTable({ holdings, isLoading }: HoldingsTableProps) {
  const prices = usePriceStore((s) => s.prices)

  const enrichedHoldings = useMemo(() => {
    return holdings.map((h) => {
      const live = prices[h.ticker]
      if (live) {
        const marketValue = live.price * h.shares
        return {
          ...h,
          price: live.price,
          changePct: live.changePct,
          marketValue,
          dayPnL: live.change * h.shares,
        }
      }
      return h
    })
  }, [holdings, prices])

  const columns = useMemo<ColumnDef<Holding, any>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: 'Symbol',
        cell: ({ getValue }) => <Ticker symbol={getValue()} />,
        size: 80,
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
        accessorKey: 'account',
        header: 'Acct',
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return v ? <Badge variant={wrapperVariant(v)}>{v}</Badge> : '—'
        },
        size: 60,
      },
      {
        accessorKey: 'shares',
        header: 'Shares',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{(getValue() as number).toLocaleString()}</span>
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
        accessorKey: 'marketValue',
        header: 'Value',
        cell: ({ row }) => (
          <CurrencyValue value={row.original.marketValueGBP ?? row.original.marketValue} />
        ),
        sortDescFirst: true,
      },
      {
        accessorKey: 'changePct',
        header: 'Day',
        cell: ({ getValue }) => <ChangeCell value={getValue()} />,
      },
      {
        accessorKey: 'weight',
        header: 'Weight',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{(getValue() as number).toFixed(1)}%</span>
        ),
        sortDescFirst: true,
      },
    ],
    []
  )

  return (
    <DensityTable
      data={enrichedHoldings}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="No holdings — import your portfolio to get started"
      skeletonRows={10}
    />
  )
}
