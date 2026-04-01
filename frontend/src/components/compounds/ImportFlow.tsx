'use client'
import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/primitives/Badge'
import type { ImportResult } from '@/types/portfolio'

type FlowState = 'idle' | 'uploading' | 'reviewing' | 'confirmed'

export function ImportFlow() {
  const [state, setState] = useState<FlowState>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const handleFile = useCallback(async (file: File) => {
    setState('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await api.portfolioImport(formData)
      setResult(data as any)
      setState('reviewing')
    } catch (err: any) {
      setError(err.message ?? 'Import failed')
      setState('idle')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleConfirm = async () => {
    setState('confirmed')
    // Invalidate portfolio queries to reload
    await qc.invalidateQueries({ queryKey: ['portfolio'] })
    await qc.invalidateQueries({ queryKey: ['portfolio-analytics'] })
  }

  if (state === 'confirmed') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <CheckCircle size={32} className="text-[var(--color-gain)]" />
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
          Portfolio imported successfully
        </p>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {result?.holdings?.length ?? 0} holdings loaded
        </p>
        <button
          onClick={() => { setState('idle'); setResult(null) }}
          className="mt-2 px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)]"
        >
          Import another
        </button>
      </div>
    )
  }

  if (state === 'reviewing' && result) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Review Import
          </h3>
          {result.formatDetected && (
            <Badge variant="accent">{result.formatDetected}</Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-[12px]">
          <span className="text-[var(--color-gain)]">{result.holdings?.length ?? 0} resolved</span>
          {result.unresolved?.length > 0 && (
            <span className="text-[var(--color-warn)]">{result.unresolved.length} unresolved</span>
          )}
        </div>

        {/* Holdings preview */}
        <div className="max-h-48 overflow-y-auto border border-[var(--color-border-subtle)] rounded">
          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th className="text-left px-2 py-1 text-[var(--color-text-muted)]">Ticker</th>
                <th className="text-left px-2 py-1 text-[var(--color-text-muted)]">Name</th>
                <th className="text-right px-2 py-1 text-[var(--color-text-muted)]">Shares</th>
                <th className="text-right px-2 py-1 text-[var(--color-text-muted)]">Value</th>
              </tr>
            </thead>
            <tbody>
              {result.holdings?.slice(0, 20).map((h, i) => (
                <tr key={i} className="border-b border-[var(--color-border-subtle)]">
                  <td className="px-2 py-1 font-mono text-[var(--color-accent-bright)]">{h.ticker}</td>
                  <td className="px-2 py-1 text-[var(--color-text-secondary)] truncate max-w-[140px]">{h.name}</td>
                  <td className="px-2 py-1 text-right text-[var(--color-text-primary)]">{h.shares.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right text-[var(--color-text-primary)]">
                    {h.value != null ? `£${h.value.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Unresolved */}
        {result.unresolved?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-[var(--color-warn)] flex items-center gap-1">
              <AlertCircle size={12} /> Unresolved ISINs
            </p>
            {result.unresolved.map((u, i) => (
              <p key={i} className="text-[11px] text-[var(--color-text-muted)] pl-4">
                {u.isin}: {u.reason}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-bright)]"
          >
            Save to Portfolio
          </button>
          <button
            onClick={() => { setState('idle'); setResult(null) }}
            className="px-4 py-2 rounded text-[12px] font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-accent)] transition-colors cursor-pointer m-4"
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.csv,.xlsx,.xls'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) handleFile(file)
        }
        input.click()
      }}
    >
      {state === 'uploading' ? (
        <>
          <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-[var(--color-text-secondary)]">Parsing portfolio...</p>
        </>
      ) : (
        <>
          <Upload size={24} className="text-[var(--color-text-muted)]" />
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            Import Portfolio
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Drag & drop CSV or Excel, or click to browse
          </p>
          <div className="flex items-center gap-2 mt-1">
            <FileSpreadsheet size={12} className="text-[var(--color-text-muted)]" />
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Supports Brewin Dolphin, HL, Quilter, SJP, generic
            </span>
          </div>
          {error && (
            <p className="text-[12px] text-[var(--color-loss)] mt-2">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
