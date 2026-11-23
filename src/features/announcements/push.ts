import { supabase } from '../../lib/supabase'
import type { Announcement } from './types'

/**
 * Kirim notifikasi web push ke portal santri saat pengumuman diterbitkan.
 * Fire-and-forget: kegagalan push tidak boleh menggagalkan penyimpanan.
 * Fungsi Edge `push-send` mengabaikan studentIds kosong = semua pelanggan.
 */
export async function sendAnnouncementPush(announcement: Announcement): Promise<void> {
  if (!announcement.is_published) return
  const plain = announcement.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  try {
    await supabase.functions.invoke('push-send', {
      body: {
        title: announcement.title,
        body: (plain || announcement.title).slice(0, 140),
        url: '/portal',
        kind: 'announcement',
      },
    })
  } catch {
    // sengaja diam
  }
}
