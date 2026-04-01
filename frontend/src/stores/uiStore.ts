import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Space = 'monitor' | 'research' | 'portfolio' | 'macro'

interface UIStore {
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  activeTicker: string | null
  activeSpace: Space
  alertPanelOpen: boolean

  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setActiveTicker: (ticker: string | null) => void
  setActiveSpace: (space: Space) => void
  setAlertPanelOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeTicker: null,
      activeSpace: 'monitor',
      alertPanelOpen: false,

      setTheme: (theme) => {
        document.documentElement.classList.toggle('light', theme === 'light')
        set({ theme })
      },
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.classList.toggle('light', next === 'light')
          return { theme: next }
        }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setActiveTicker: (ticker) => set({ activeTicker: ticker }),
      setActiveSpace: (space) => set({ activeSpace: space }),
      setAlertPanelOpen: (open) => set({ alertPanelOpen: open }),
    }),
    {
      name: 'mkts-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        activeSpace: state.activeSpace,
      }),
    }
  )
)
