import { supabase } from '../../lib/supabase'
import type { Announcement, AnnouncementPatch } from './types'

export interface AnnouncementFilters {
  search?: string
  category?: string
  status?: 'all' | 'published' | 'draft'
}

// ------------------------------------------------------------
// Daftar pengumuman (halaman Informasi)
// Volume rendah (puluhan per tahun) — tanpa pagination, cukup limit
// ------------------------------------------------------------
export async function fetchAnnouncements(filters: AnnouncementFilters): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters.search) query = query.ilike('title', `%${filters.search}%`)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status === 'published') query = query.eq('is_published', true)
  if (filters.status === 'draft') query = query.eq('is_published', false)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Announcement[]
}

export async function createAnnouncement(patch: AnnouncementPatch): Promise<Announcement> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('announcements')
    .insert({ ...patch, created_by: user?.id ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Announcement
}

export async function updateAnnouncement(id: string, patch: AnnouncementPatch): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Announcement
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Portal publik /cek — hanya terbit + publik, anon read via RLS
// ------------------------------------------------------------
export interface PublicAnnouncement {
  id: string
  title: string
  body: string
  category: string
  published_at: string
}

export async function fetchPublicAnnouncements(): Promise<PublicAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, category, published_at')
    .eq('is_published', true)
    .eq('is_public', true)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as PublicAnnouncement[]
}
