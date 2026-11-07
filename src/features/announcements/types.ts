export const ANNOUNCEMENT_CATEGORIES = [
  'Pengumuman',
  'Informasi',
  'Akademik',
  'Kesantrian',
  'Darurat',
] as const

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

/** Warna tag per kategori — dipakai di halaman Informasi & portal publik /cek */
export const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  Pengumuman: 'blue',
  Informasi: 'geekblue',
  Akademik: 'purple',
  Kesantrian: 'cyan',
  Darurat: 'red',
}

export interface Announcement {
  id: string
  title: string
  body: string
  category: AnnouncementCategory
  is_pinned: boolean
  is_published: boolean
  is_public: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Nilai yang bisa dikirim dari form / aksi cepat di list */
export interface AnnouncementPatch {
  title?: string
  body?: string
  category?: AnnouncementCategory
  is_pinned?: boolean
  is_published?: boolean
  is_public?: boolean
  published_at?: string | null
}
