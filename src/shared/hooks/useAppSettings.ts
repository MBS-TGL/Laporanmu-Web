import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../utils/auditLogger'

export interface AppSetting {
  key: string
  value: unknown
  updated_at: string
}

export async function fetchAppSettings(): Promise<AppSetting[]> {
  const { data, error } = await supabase.from('app_settings').select('*')
  if (error) throw error
  return (data ?? []) as AppSetting[]
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: fetchAppSettings,
    staleTime: 30_000,
  })
}

// Baca satu setting jsonb dengan fallback bila tabel belum di-migrate,
// baris tidak ada, atau query gagal (fail-open, sama seperti useFlag).
export function useAppSetting<T>(key: string, fallback: T): T {
  const { data } = useAppSettings()
  if (!data) return fallback
  const row = data.find((s) => s.key === key)
  return row ? (row.value as T) : fallback
}

export interface MaintenanceMessageValue {
  message?: string
  until?: string | null
}

const DEFAULT_MAINTENANCE_MESSAGE = 'Aplikasi sementara ditutup untuk perawatan. Silakan coba beberapa saat lagi.'

// Pesan pemeliharaan kustom (diatur di tab Pengaturan Developer).
// Kunci maintenance.% bisa dibaca anon (route publik), sisanya hanya staff.
export function useMaintenanceMessage(): { message: string; until: string | null; isLoading: boolean } {
  const { data, isLoading } = useAppSettings()
  const row = data?.find((s) => s.key === 'maintenance.message')
  const value = (row?.value ?? {}) as MaintenanceMessageValue
  return {
    message: value.message?.trim() ? value.message : DEFAULT_MAINTENANCE_MESSAGE,
    until: value.until ?? null,
    isLoading,
  }
}

export function useUpdateAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_by: user?.id ?? null }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: (_data, { key }) => {
      void qc.invalidateQueries({ queryKey: ['app-settings'] })
      void logAudit({
        action: 'UPDATE',
        source: 'SYSTEM',
        tableName: 'app_settings',
        recordId: key,
        newData: { key },
      })
    },
  })
}
