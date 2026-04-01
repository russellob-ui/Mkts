import { create } from 'zustand'

export interface Alert {
  id: number
  ticker: string
  condition: 'above' | 'below'
  threshold: number
  triggered: boolean
  createdAt: string
}

interface AlertStore {
  alerts: Alert[]
  unreadCount: number
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  removeAlert: (id: number) => void
  markAllRead: () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,

  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((s) => ({ alerts: [...s.alerts, alert] })),
  removeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  markAllRead: () => set({ unreadCount: 0 }),
}))
