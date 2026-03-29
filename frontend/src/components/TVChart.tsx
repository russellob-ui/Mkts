import { useEffect, useRef } from 'react'

interface TVChartProps {
  ticker: string
  height?: number
}

function toTVSymbol(ticker: string): string {
  const t = ticker.toUpperCase()
  if (t.endsWith('.L')) return `LSE:${t.slice(0, -2)}`
  if (t === 'SPY')  return 'AMEX:SPY'
  if (t === 'QQQ')  return 'NASDAQ:QQQ'
  if (t === 'DIA')  return 'AMEX:DIA'
  if (t === 'ISF.L') return 'LSE:ISF'
  return t
}

export default function TVChart({ ticker, height = 400 }: TVChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const symbol = toTVSymbol(ticker)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.height = `${height}px`
    wrapper.style.width = '100%'

    const inner = document.createElement('div')
    inner.className = 'tradingview-widget-container__widget'
    inner.style.height = '100%'
    wrapper.appendChild(inner)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#1e293b',
      gridColor: 'rgba(148,163,184,0.06)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })
    wrapper.appendChild(script)
    container.appendChild(wrapper)

    return () => {
      container.innerHTML = ''
    }
  }, [symbol, height])

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden bg-navy-800"
      style={{ height }}
    />
  )
}
