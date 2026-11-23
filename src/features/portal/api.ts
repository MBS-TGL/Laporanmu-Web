/**
 * P5c Portal Santri — wrapper RPC publik (anon) + tipe data portal.
 * Semua akses via RPC bertoken (migration 0053); halaman TIDAK pernah
 * menyentuh tabel langsung.
 */
import { supabase } from '../../lib/supabase'

export interface PortalSession {
  token: string
  expiresAt: string
}

export interface PortalScheduleItem {
  start_time: string
  end_time: string
  subject: string | null
  teacher: string | null
  room: string | null
}

export interface PortalGradeItem {
  subject: string | null
  type: string
  title: string
  score: number | null
  max_score: number
  date: string | null
}

export interface PortalAttendanceRow {
  year: number
  month: number
  days: Record<string, string>
}

export interface PortalPointItem {
  rule: string
  points: number
  notes: string | null
  reported_at: string
}

export interface PortalSppItem {
  component: string
  period: string
  amount: number
  paid: number
  due_date: string | null
}

export interface PortalTahfidzItem {
  kind: 'ziyadah' | 'murojaah'
  surah: string
  from_ayat: number | null
  to_ayat: number | null
  quality: 'excellent' | 'good' | 'needs_work' | null
  recorded_at: string
}

export interface PortalWorshipProgress {
  category: 'wudhu' | 'sholat' | 'hafalan_hadist' | 'hafalan_doa'
  totalItems: number
  masteredCount: number
}

export interface PortalData {
  student: {
    id: string
    name: string
    class_name: string | null
    photo_url: string | null
    status: string
    total_points: number
  }
  schedule: PortalScheduleItem[]
  grades: PortalGradeItem[]
  attendance: PortalAttendanceRow[]
  points: { total: number; recent: PortalPointItem[] }
  spp: { items: PortalSppItem[]; total_due: number; total_paid: number }
  tahfidz: PortalTahfidzItem[]
  worship: PortalWorshipProgress[]
}

export interface PortalNotification {
  id: string
  title: string
  body: string
  url: string | null
  kind: 'announcement' | 'spp' | 'report' | 'general'
  read_at: string | null
  created_at: string
}

export interface PortalNotificationsResult {
  items: PortalNotification[]
  unread_count: number
}

export interface PortalLoginResult {
  token: string
  expires_at: string
  student: { name: string; class_name: string | null }
}

export async function rpcPortalLogin(code: string, pin: string): Promise<PortalLoginResult> {
  const { data, error } = await supabase.rpc('portal_login', { p_code: code, p_pin: pin })
  if (error) throw error
  return data as PortalLoginResult
}

export async function rpcPortalLogout(token: string): Promise<void> {
  const { error } = await supabase.rpc('portal_logout', { p_token: token })
  if (error) throw error
}

export async function rpcPortalData(token: string): Promise<PortalData> {
  const { data, error } = await supabase.rpc('portal_data', { p_token: token })
  if (error) throw error
  return data as PortalData
}

export async function rpcPortalPushConfig(token: string): Promise<{ vapid_public: string | null }> {
  const { data, error } = await supabase.rpc('portal_push_config', { p_token: token })
  if (error) throw error
  return data as { vapid_public: string | null }
}

export async function rpcPortalSavePush(token: string, subscription: PushSubscriptionJSON): Promise<void> {
  const { error } = await supabase.rpc('portal_save_push', {
    p_token: token,
    p_subscription: { ...subscription, user_agent: navigator.userAgent },
  })
  if (error) throw error
}

export async function rpcPortalDeletePush(token: string, endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('portal_delete_push', { p_token: token, p_endpoint: endpoint })
  if (error) throw error
}

export async function rpcPortalNotifications(token: string): Promise<PortalNotificationsResult> {
  const { data, error } = await supabase.rpc('portal_notifications', { p_token: token })
  if (error) throw error
  return data as PortalNotificationsResult
}

export async function rpcPortalMarkNotificationRead(token: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('portal_mark_notification_read', { p_token: token, p_id: id })
  if (error) throw error
}

// ─── Murni (dipakai UI + test) ───────────────────────────────────────────────

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A' | 'P'

/** Rekap H/S/I/A/P dari days jsonb bulanan (format sama dgn attendance/api). */
export function summarizeDays(days: Record<string, string>): Record<AttendanceStatus, number> {
  const out: Record<AttendanceStatus, number> = { H: 0, S: 0, I: 0, A: 0, P: 0 }
  for (const v of Object.values(days)) {
    const s = String(v).trim().toUpperCase() as AttendanceStatus
    if (s in out) out[s] += 1
  }
  return out
}
