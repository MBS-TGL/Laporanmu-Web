import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { deleteStorageFiles, extractStorageRef } from './api'
import type { BucketInfo } from './types'
import { logAudit } from '../../shared/utils/auditLogger'

// ------------------------------------------------------------
// Media library — browse, upload, preview, dan hapus file di
// bucket Supabase Storage, dengan pemindaian referensi sebelum
// hapus (file yang masih dirujuk kolom URL tidak boleh hilang).
// ------------------------------------------------------------

export interface MediaFile {
  bucket: string
  /** Path lengkap dalam bucket, termasuk prefix folder */
  path: string
  name: string
  size: number
  mimetype: string
  updatedAt: string | null
  isImage: boolean
}

/** Sumber kolom URL storage yang dirujuk aplikasi — perluas saat ada modul baru. */
export const MEDIA_REF_SOURCES: { table: string; column: string }[] = [
  { table: 'profiles', column: 'avatar_url' },
  { table: 'students', column: 'photo_url' },
  { table: 'teachers', column: 'photo_url' },
]

export interface MediaListing {
  folders: string[]
  files: MediaFile[]
}

/** List satu folder bucket — entry id === null adalah folder pseudo. */
export async function fetchBucketFiles(bucket: string, prefix: string): Promise<MediaListing> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error
  const folders: string[] = []
  const files: MediaFile[] = []
  for (const entry of data ?? []) {
    if (entry.id === null) {
      folders.push(entry.name)
      continue
    }
    const metadata = entry.metadata
    if (!metadata) continue
    files.push({
      bucket,
      path: prefix ? `${prefix}/${entry.name}` : entry.name,
      name: entry.name,
      size: metadata.size ?? 0,
      mimetype: metadata.mimetype ?? '',
      updatedAt: entry.updated_at ?? null,
      isImage: (metadata.mimetype ?? '').startsWith('image/'),
    })
  }
  return { folders, files }
}

/**
 * Kumpulkan seluruh referensi storage yang dipakai data — Set berisi
 * `bucket/path`. Scan dibatasi kolom di MEDIA_REF_SOURCES; hasil scan
 * belum lengkap bila ada tabel yang gagal dibaca.
 */
export async function scanMediaReferences(): Promise<{ refs: Set<string>; failedTables: string[] }> {
  const failedTables: string[] = []
  const refs = new Set<string>()
  await Promise.all(
    MEDIA_REF_SOURCES.map(async ({ table, column }) => {
      const { data, error } = await supabase.from(table).select(column)
      if (error) {
        failedTables.push(`${table}.${column}`)
        return
      }
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        const ref = extractStorageRef(row[column])
        if (ref) refs.add(`${ref.bucket}/${ref.path}`)
      }
    }),
  )
  return { refs, failedTables }
}

/** URL akses file: public URL untuk bucket publik, signed URL 1 jam untuk privat. */
export async function getMediaFileUrl(bucket: string, path: string, isPublic: boolean): Promise<string> {
  if (isPublic) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Unduh file via blob supaya file privat ikut terunduh dengan nama aslinya. */
export async function downloadMediaFile(bucket: string, path: string, name: string, isPublic: boolean): Promise<void> {
  const url = await getMediaFileUrl(bucket, path, isPublic)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mengunduh file')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export interface UploadResult {
  uploaded: string[]
  failed: { name: string; message: string }[]
}

/** Upload banyak file ke folder. Nama file aman; tabrakan nama = gagal (upsert false). */
export async function uploadMediaFiles(bucket: string, prefix: string, files: File[]): Promise<UploadResult> {
  const uploaded: string[] = []
  const failed: UploadResult['failed'] = []
  for (const file of files) {
    // Nama disanitasi: spasi → tanda hubung, buang karakter bermasalah di URL
    const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = prefix ? `${prefix}/${safeName}` : safeName
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      failed.push({ name: file.name, message: error.message })
    } else {
      uploaded.push(path)
    }
  }
  if (uploaded.length > 0) {
    await logAudit({
      action: 'INSERT',
      tableName: `storage:${bucket}`,
      newData: { count: uploaded.length, prefix, files: uploaded },
    })
  }
  return { uploaded, failed }
}

// ------------------------------------------------------------
// Hooks
// ------------------------------------------------------------
export function useBucketsMedia(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'buckets'],
    queryFn: async () => {
      const { data, error } = await supabase.storage.listBuckets()
      if (error) throw error
      return (data ?? []) as BucketInfo[]
    },
    staleTime: 5 * 60_000,
    retry: false,
    enabled: opts?.enabled,
  })
}

export function useBucketFiles(bucket: string | null, prefix: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'media', bucket, prefix],
    queryFn: () => fetchBucketFiles(bucket as string, prefix),
    enabled: !!bucket && (opts?.enabled ?? true),
  })
}

// Scan referensi manual (mahal) — dijalankan lewat refetch()
export function useMediaReferenceScan() {
  return useQuery({
    queryKey: ['admin', 'media-refs'],
    queryFn: scanMediaReferences,
    enabled: false,
  })
}

function useInvalidateMedia() {
  const qc = useQueryClient()
  return (bucket: string, prefix: string) => {
    void qc.invalidateQueries({ queryKey: ['admin', 'media', bucket, prefix] })
    void qc.invalidateQueries({ queryKey: ['admin', 'media', bucket, ''] })
    void qc.invalidateQueries({ queryKey: ['admin', 'buckets'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'storage-largest'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'storage-orphan'] })
  }
}

export function useUploadMedia(bucket: string | null, prefix: string) {
  const invalidate = useInvalidateMedia()
  return useMutation({
    mutationFn: (files: File[]) => uploadMediaFiles(bucket as string, prefix, files),
    onSuccess: () => invalidate(bucket as string, prefix),
  })
}

export function useDeleteMedia(bucket: string | null, prefix: string) {
  const invalidate = useInvalidateMedia()
  return useMutation({
    mutationFn: async (paths: string[]) => {
      await deleteStorageFiles(bucket as string, paths)
      await logAudit({ action: 'DELETE', tableName: `storage:${bucket}`, newData: { count: paths.length, paths } })
      return paths
    },
    onSuccess: () => invalidate(bucket as string, prefix),
  })
}
