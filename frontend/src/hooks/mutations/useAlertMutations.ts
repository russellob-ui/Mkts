'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useCreateAlert() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (alert: { ticker: string; alert_type: string; value: number }) =>
      api.alertCreate(alert),
    onSettled: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useDeleteAlert() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.alertDelete(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
