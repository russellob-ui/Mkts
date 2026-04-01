'use client'
import { X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAlertStore } from '@/stores/alertStore'
import { cn } from '@/lib/utils'

export function AlertPanel() {
  const { alertPanelOpen, setAlertPanelOpen } = useUIStore()
  const { alerts, markAllRead } = useAlertStore()

  if (!alertPanelOpen) return null

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setAlertPanelOpen(false)}
      />
      <div className="absolute right-0 top-0 h-full w-80 bg-[var(--color-bg-surface)] border-l border-[var(--color-border-subtle)] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--color-border-subtle)] shrink-0">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Alerts</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent-bright)]"
            >
              Mark all read
            </button>
            <button
              onClick={() => setAlertPanelOpen(false)}
              className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto py-2">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[12px] text-[var(--color-text-muted)]">
              No alerts configured
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'px-4 py-3 border-b border-[var(--color-border-subtle)] text-[12px]',
                  alert.triggered && 'bg-[var(--color-loss-dim)]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-[var(--color-accent-bright)]">
                    {alert.ticker}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {alert.condition} {alert.threshold}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
