'use client'
import { useUIStore } from '@/stores/uiStore'
import { Panel } from '@/components/primitives/Panel'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import { Sun, Moon, Trash2 } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const { theme, toggleTheme } = useUIStore()
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('mkts_session_id') ?? ''
  })

  const handleClearData = () => {
    if (confirm('This will clear your local session. Your portfolio and watchlist will appear empty until you re-import. Continue?')) {
      localStorage.removeItem('mkts_session_id')
      localStorage.removeItem('mkts-ui')
      localStorage.removeItem('mkts-watchlist')
      window.location.reload()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Settings</h1>

      {/* Theme */}
      <Panel>
        <PanelHeader title="Appearance" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--color-text-primary)]">Theme</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Switch between dark and light mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border-default)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </Panel>

      {/* Session */}
      <Panel>
        <PanelHeader title="Session" />
        <div className="space-y-3">
          <div>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-1">Session ID</p>
            <code className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] px-2 py-1 rounded block">
              {sessionId || 'Not set'}
            </code>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Your session ID links your browser to your saved portfolio and watchlist data.
          </p>
        </div>
      </Panel>

      {/* Danger zone */}
      <Panel>
        <PanelHeader title="Data" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--color-text-primary)]">Clear local data</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Reset session, theme, and watchlist. Portfolio data on the server is not deleted.
            </p>
          </div>
          <button
            onClick={handleClearData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-loss)] text-[12px] font-medium text-[var(--color-loss)] hover:bg-[var(--color-loss-dim)]"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </Panel>

      {/* About */}
      <Panel>
        <PanelHeader title="About" />
        <div className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
          <p>MKTS v6.0 — Personal Market Research Terminal</p>
          <p className="text-[var(--color-text-muted)]">
            Built with Next.js, FastAPI, TradingView Lightweight Charts, and Claude AI.
          </p>
        </div>
      </Panel>
    </div>
  )
}
