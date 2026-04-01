'use client'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DensityTable } from '@/components/primitives/DensityTable'
import { ChangeCell } from '@/components/primitives/ChangeCell'
import { Ticker } from '@/components/primitives/Ticker'
import { CurrencyValue } from '@/components/primitives/CurrencyValue'
import type { MonitorItem } from '@/types/market'
import { usePriceStore } from '@/stores/priceStore'

interface MarketTableProps {
  data: MonitorItem[]
  isLoading?: boolean
}

export function MarketTable({ data, isLoading }: MarketTableProps) {
  const prices = usePriceStore((s) => s.prices)

  const enrichedData = useMemo(() => {
    return data.map((item) => {
      const live = prices[item.symbol]
      if (live) {
        return { ...item, price: live.price, changePct: live.changePct }
      }
      return item
    })
  }, [data, prices])

  const columns = useMemo<ColumnDef<MonitorItem, any>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ getValue }) => <Ticker symbol={getValue()} />,
        size: 80,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)] truncate max-w-[160px] block">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ getValue }) => <CurrencyValue value={getValue()} />,
      },
      {
        accessorKey: 'dayChangePct',
        header: '1D',
        cell: ({ getValue }) => <ChangeCell value={getValue()} />,
        sortDescFirst: true,
      },
      {
        accessorKey: 'weekChangePct',
        header: '1W',
        cell: ({ getValue }) => <ChangeCell value={getValue()} />,
        sortDescFirst: true,
      },
      {
        accessorKey: 'monthChangePct',
        header: '1M',
        cell: ({ getValue }) => <ChangeCell value={getValue()} />,
        sortDescFirst: true,
      },
    ],
    []
  )

  return (
    <DensityTable
      data={enrichedData}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="No market data available"
      skeletonRows={12}
    />
  )
}
