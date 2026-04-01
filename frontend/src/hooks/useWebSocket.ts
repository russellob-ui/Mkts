'use client'
import { useEffect, useRef } from 'react'
import { usePriceStore } from '@/stores/priceStore'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws/prices'

export function useWebSocket(tickers: string[]) {
  const ws = useRef<WebSocket | null>(null)
  const cancelledRef = useRef(false)
  const { updatePrice, setConnected, previousCloses } = usePriceStore()

  useEffect(() => {
    if (tickers.length === 0) return

    cancelledRef.current = false

    const connect = () => {
      if (cancelledRef.current) return

      try {
        ws.current = new WebSocket(WS_URL)

        ws.current.onopen = () => {
          setConnected(true)
          // Fixed: backend expects 'action' not 'type'
          ws.current?.send(JSON.stringify({ action: 'subscribe', tickers }))
        }

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'price' && data.ticker) {
              // Derive change from previousClose since backend WS only sends price + volume
              const prevClose = previousCloses[data.ticker] ?? data.price
              const change = data.price - prevClose
              const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0

              updatePrice({
                ticker: data.ticker,
                price: data.price,
                change,
                changePct,
                volume: data.volume,
                timestamp: Date.now(),
              })
            }
          } catch {}
        }

        ws.current.onclose = () => {
          setConnected(false)
          if (!cancelledRef.current) {
            setTimeout(connect, 3000)
          }
        }

        ws.current.onerror = () => {
          ws.current?.close()
        }
      } catch {}
    }

    connect()

    return () => {
      cancelledRef.current = true
      ws.current?.close()
      ws.current = null
    }
    // Callers must memoize tickers array or use a stable reference
  }, [tickers.join(',')])
}
