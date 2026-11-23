import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'

export interface PortalSession {
  id: string
  student_id: string
  student_name: string
  class_name: string | null
  created_at: string
  expires_at: string
  last_seen_at: string
  revoked_at: string | null
  is_active: boolean
}

export interface PortalAttempt {
  code_prefix: string
  attempted_at: string
}

export interface PushSubscriptionRow {
  id: string
  student_id: string
  student_name: string
  endpoint: string
  user_agent: string | null
  last_used_at: string
  created_at: string
}

export async function fetchPortalSessions(): Promise<PortalSession[]> {
  const { data, error } = await supabase.rpc('admin_portal_sessions')
  if (error) throw error
  return (data ?? []) as PortalSession[]
}

export async function fetchPortalAttempts(): Promise<PortalAttempt[]> {
  const { data, error } = await supabase.rpc('admin_portal_attempts')
  if (error) throw error
  return (data ?? []) as PortalAttempt[]
}

export async function fetchPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase.rpc('admin_push_subscriptions')
  if (error) throw error
  return (data ?? []) as PushSubscriptionRow[]
}

export async function revokePortalSession(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_portal_session', { p_id: id })
  if (error) throw error
}

export async function deletePushSubscription(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_push', { p_id: id })
  if (error) throw error
}

export function usePortalSessions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'portal-sessions'],
    queryFn: fetchPortalSessions,
    enabled,
    refetchInterval: 30_000,
  })
}

export function usePortalAttempts(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'portal-attempts'],
    queryFn: fetchPortalAttempts,
    enabled,
  })
}

export function usePushSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'push-subscriptions'],
    queryFn: fetchPushSubscriptions,
    enabled,
  })
}

export function useRevokePortalSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokePortalSession,
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'EXECUTE',
        source: 'SECURITY',
        tableName: 'portal_sessions',
        recordId: id,
        newData: { revoked: true },
      })
      void qc.invalidateQueries({ queryKey: ['admin', 'portal-sessions'] })
    },
  })
}

export function useDeletePushSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePushSubscription,
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'SYSTEM',
        tableName: 'push_subscriptions',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['admin', 'push-subscriptions'] })
    },
  })
}
