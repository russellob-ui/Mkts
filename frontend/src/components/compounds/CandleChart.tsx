'use client'
import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, ColorType, type IChartApi } from 'lightweight-charts'
import type { Candle } from '@/types/market'
import { useUIStore } from '@/stores/uiStore'
import { Skeleton } from '@/components/primitives/Skeleton'

interface CandleChartProps {
  candles: Candle[] | null | undefined
  isLoading?: boolean
  height?: number
}

export function CandleChart({ candles, isLoading, height = 360 }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)
  const volumeRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)
  const theme = useUIStore((s) => s.theme)

  const isDark = theme === 'dark'

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#8B92A5' : '#64748B',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? '#1F2330' : '#F1F5F9' },
        horzLines: { color: isDark ? '#1F2330' : '#F1F5F9' },
      },
      crosshair: {
        vertLine: { color: isDark ? '#3A4055' : '#CBD5E1', labelBackgroundColor: isDark ? '#1E222D' : '#334155' },
        horzLine: { color: isDark ? '#3A4055' : '#CBD5E1', labelBackgroundColor: isDark ? '#1E222D' : '#334155' },
      },
      rightPriceScale: {
        borderColor: isDark ? '#1F2330' : '#E2E8F0',
      },
      timeScale: {
        borderColor: isDark ? '#1F2330' : '#E2E8F0',
        timeVisible: false,
      },
    })

    // lightweight-charts v5: use addSeries(SeriesType, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B98199',
      wickDownColor: '#EF444499',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    seriesRef.current = candleSeries
    volumeRef.current = volumeSeries

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeRef.current = null
    }
  }, [isDark, height])

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current || !candles || candles.length === 0) return

    const candleData = candles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const volumeData = candles.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? '#10B98140' : '#EF444440',
    }))

    seriesRef.current.setData(candleData)
    volumeRef.current.setData(volumeData)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  if (isLoading) {
    return <div style={{ height }}><Skeleton className="w-full h-full" /></div>
  }

  if (!candles || candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-[var(--color-text-muted)]"
        style={{ height }}
      >
        No chart data available
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
}
