import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Alert, Breadcrumb, Button, Card, Empty, Input, Pagination, Select, Skeleton, Space, Tag, Tooltip, theme } from 'antd'
import {
  CloudUploadOutlined,
  FileImageOutlined,
  FileOutlined,
  FolderOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useRbac } from '../../shared/rbac/useRbac'
import { getMediaFileUrl, useBucketsMedia, useBucketFiles, useMediaReferenceScan, useUploadMedia, useDeleteMedia, type MediaFile } from './media'
import { PreviewModal } from './components/PreviewModal'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Tab Media Library — browse bucket + folder, unggah, pratinjau, dan
 * hapus file storage. Badge Terpakai/Orphan mengikuti hasil scan
 * referensi (kolom URL di MEDIA_REF_SOURCES); hapus tetap tersedia
 * untuk file terpakai lewat konfirmasi eksplisit dengan peringatan.
 */
export function MediaPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { can } = useRbac()
  const canUpload = can('media:upload')
  const canDelete = can('media:delete')

  const bucketsQuery = useBucketsMedia({ enabled: active })
  const buckets = bucketsQuery.data ?? []
  const [bucketName, setBucketName] = useState<string | null>(null)
  const [prefix, setPrefix] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const activeBucket = buckets.find((b) => b.name === bucketName) ?? buckets[0] ?? null
  const filesQuery = useBucketFiles(activeBucket?.name ?? null, prefix, { enabled: active })
  const refsScan = useMediaReferenceScan()
  const uploadMutation = useUploadMedia(activeBucket?.name ?? null, prefix)
  const deleteMutation = useDeleteMedia(activeBucket?.name ?? null, prefix)

  // Scan referensi sekali saat tab pertama kali aktif
  useEffect(() => {
    if (active && !refsScan.isFetched && !refsScan.isFetching) {
      void refsScan.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Bucket default = bucket pertama yang terbaca
  useEffect(() => {
    if (!bucketName && buckets.length > 0) setBucketName(buckets[0].name)
  }, [buckets, bucketName])

  const listing = filesQuery.data
  const allFiles = useMemo(() => listing?.files ?? [], [listing])
  const filteredFiles = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return allFiles
    return allFiles.filter((f) => f.name.toLowerCase().includes(q))
  }, [allFiles, debouncedSearch])

  // Grid dibatasi 60 file/halaman — hingga 1.000 file dari list() tidak
  // dirender sekaligus (thumbnail image + signed URL per item).
  const PAGE_SIZE = 60
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1) // daftar berubah (folder/filter) → kembali ke halaman pertama
  }, [filteredFiles])
  const pageFiles = useMemo(
    () => filteredFiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredFiles, page],
  )

  const refs = refsScan.data?.refs
  const isReferenced = (file: MediaFile) => (refs ? refs.has(`${file.bucket}/${file.path}`) : null)

  const totalSize = useMemo(() => allFiles.reduce((sum, f) => sum + f.size, 0), [allFiles])
  const unusedCount = useMemo(
    () => (refs ? allFiles.filter((f) => !refs.has(`${f.bucket}/${f.path}`)).length : null),
    [allFiles, refs],
  )

  const breadcrumbParts = prefix ? prefix.split('/') : []
  const openFolder = (folder: string) => {
    setPrefix(prefix ? `${prefix}/${folder}` : folder)
    setSearch('')
  }
  const navigateTo = (index: number) => {
    setPrefix(breadcrumbParts.slice(0, index).join('/'))
    setSearch('')
  }

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const result = await uploadMutation.mutateAsync(files)
    if (result.failed.length === 0) {
      message.success(`${result.uploaded.length} file terunggah`)
    } else {
      const detail = result.failed.map((f) => `${f.name} (${f.message})`).join(', ')
      message.warning(`${result.uploaded.length} terunggah, ${result.failed.length} gagal: ${detail}`)
    }
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  const handleDelete = async (file: MediaFile) => {
    try {
      await deleteMutation.mutateAsync([file.path])
      message.success(`"${file.name}" dihapus`)
      setPreviewFile(null)
    } catch (err) {
      message.error(`Gagal menghapus: ${err instanceof Error ? err.message : 'kesalahan tidak diketahui'}`)
    }
  }

  const headerActions = useTabActions(
    active,
    <Space wrap>
      {refsScan.isFetched && (
        <Tooltip title={refsScan.data?.failedTables.length ? `Scan belum lengkap: ${refsScan.data.failedTables.join(', ')}` : 'Perbarui hasil scan referensi'}>
          <Button icon={<ScanOutlined />} loading={refsScan.isFetching} onClick={() => void refsScan.refetch()}>
            Scan Referensi
          </Button>
        </Tooltip>
      )}
      {canUpload && (
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          loading={uploadMutation.isPending}
          disabled={!activeBucket}
          onClick={() => uploadInputRef.current?.click()}
        >
          Unggah
        </Button>
      )}
    </Space>,
  )

  if (bucketsQuery.isPending) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  }

  if (bucketsQuery.isError || buckets.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Bucket storage tidak terbaca"
        description={
          bucketsQuery.isError
            ? 'Periksa kebijakan storage di Supabase, daftar bucket ditolak untuk sesi ini.'
            : 'Belum ada bucket di proyek Supabase ini. Buat bucket lewat dashboard Supabase terlebih dulu.'
        }
      />
    )
  }

  return (
    <div>
      {headerActions}
      {refsScan.data && refsScan.data.failedTables.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 14 }}
          message={`Scan referensi belum lengkap (gagal: ${refsScan.data.failedTables.join(', ')}). Badge "Terpakai" bisa meleset, hapus dengan hati-hati.`}
        />
      )}
      {canUpload && (
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => void handleUpload(e.target.files)}
          aria-label="Pilih file untuk diunggah"
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <StatChip icon={<FileOutlined />} label="File di folder ini" value={allFiles.length} color="indigo" loading={filesQuery.isPending} />
        <StatChip icon={<CloudUploadOutlined />} label="Total ukuran" value={formatSize(totalSize)} color="sky" loading={filesQuery.isPending} />
        <StatChip
          icon={<ScanOutlined />}
          label="Tidak terpakai"
          value={unusedCount === null ? 'Belum discan' : unusedCount}
          color={unusedCount === 0 ? 'emerald' : 'amber'}
          loading={filesQuery.isPending}
        />
      </div>

      <Card size="small">
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }}>
          <Space wrap size="small">
            <Select
              value={activeBucket?.name ?? undefined}
              onChange={(name: string) => {
                setBucketName(name)
                setPrefix('')
              }}
              style={{ minWidth: 180 }}
              aria-label="Pilih bucket"
              options={buckets.map((b) => ({
                value: b.name,
                label: (
                  <Space size={6}>
                    <span>{b.name}</span>
                    <Tag color={b.public ? 'success' : 'default'} style={{ borderRadius: 6, fontSize: 10, lineHeight: '14px', marginInlineEnd: 0 }}>
                      {b.public ? 'Publik' : 'Privat'}
                    </Tag>
                  </Space>
                ),
              }))}
            />
            <Breadcrumb
              items={[
                {
                  title: (
                    <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setPrefix('')}>
                      {activeBucket?.name}
                    </Button>
                  ),
                },
                ...breadcrumbParts.map((part, i) => ({
                  title: (
                    <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => navigateTo(i + 1)}>
                      {part}
                    </Button>
                  ),
                })),
              ]}
            />
          </Space>
          <Space wrap>
            <Input
              placeholder="Cari nama file"
              allowClear
              prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, maxWidth: '100%' }}
            />
            <Tooltip title="Muat ulang daftar file">
              <Button icon={<ReloadOutlined />} loading={filesQuery.isFetching} onClick={() => filesQuery.refetch()} aria-label="Muat ulang" />
            </Tooltip>
          </Space>
        </Space>

        {/* ── Folder anak ── */}
        {listing && listing.folders.length > 0 && debouncedSearch === '' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {listing.folders.map((folder) => (
              <Button key={folder} icon={<FolderOutlined />} onClick={() => openFolder(folder)}>
                {folder}
              </Button>
            ))}
          </div>
        )}

        {filesQuery.isPending ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton.Node key={i} active style={{ width: '100%', height: 150 }} />
            ))}
          </div>
        ) : filesQuery.isError ? (
          <Alert type="error" showIcon message="Gagal memuat daftar file" description={String(filesQuery.error)} />
        ) : filteredFiles.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              allFiles.length > 0
                ? 'Tidak ada file yang cocok dengan pencarian'
                : prefix === ''
                  ? 'Bucket ini kosong di level root. Unggah file lewat tombol Unggah.'
                  : 'Folder ini kosong.'
            }
          />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {pageFiles.map((file) => {
              const referenced = isReferenced(file)
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setPreviewFile(file)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 8,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    borderRadius: 12,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = token.colorPrimary
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = token.colorBorderSecondary
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'rgba(15, 23, 42, 0.04)',
                      display: 'grid',
                      placeItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Thumb file={file} isPublicBucket={activeBucket?.public ?? false} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
                    {formatSize(file.size)}
                  </span>
                  {referenced !== null && (
                    <span style={{ marginTop: 4 }}>
                      <StatusTag color={referenced ? 'success' : 'default'}>{referenced ? 'Terpakai' : 'Orphan'}</StatusTag>
                    </span>
                  )}
                </button>
              )
              })}
            </div>
            {filteredFiles.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={filteredFiles.length}
                  onChange={setPage}
                  showSizeChanger={false}
                  showTotal={(t) => `${t} file`}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <PreviewModal
        file={previewFile}
        isPublicBucket={activeBucket?.public ?? false}
        referenced={previewFile ? isReferenced(previewFile) === true : false}
        canDelete={canDelete}
        onClose={() => setPreviewFile(null)}
        onDelete={handleDelete}
        deleting={deleteMutation.isPending}
      />
    </div>
  )
}

/** Thumbnail kartu: gambar via public/signed URL (privat diresolves async), ikon untuk tipe lain. */
function Thumb({ file, isPublicBucket }: { file: MediaFile; isPublicBucket: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setUrl(null)
    setFailed(false)
    if (!file.isImage) return
    let cancelled = false
    getMediaFileUrl(file.bucket, file.path, isPublicBucket)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [file, isPublicBucket])

  if (file.isImage && url && !failed) {
    return (
      <img
        src={url}
        alt={file.name}
        width={150}
        height={150}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setFailed(true)}
      />
    )
  }
  return <FileImageOutlined style={{ fontSize: 36, color: 'rgba(15, 23, 42, 0.3)' }} aria-hidden="true" />
}
