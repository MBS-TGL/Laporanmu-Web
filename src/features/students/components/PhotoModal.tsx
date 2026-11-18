import { useMemo, useState } from 'react'
import { App, Button, Progress, Segmented, Select, Tag, theme, Tooltip, Typography, Upload } from 'antd'
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  LoadingOutlined,
  PlusOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { compressImage } from '../../../shared/utils/imageCompress'
import { useStudents, useUpdateStudentPhoto } from '../hooks'
import type { Student } from '../types'

const { Text } = Typography

interface PhotoModalProps {
  open: boolean
  onClose: () => void
}

type EntryStatus = 'idle' | 'uploading' | 'success' | 'error'

interface PhotoEntry {
  uid: string
  fileName: string
  file: File
  previewUrl: string
  studentId?: string
  matched: boolean
  status: EntryStatus
  error?: string
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function autoMatch(fileName: string, students: Student[]): string | undefined {
  const base = fileName.replace(/\.[^.]+$/, '')
  const key = norm(base)
  if (!key) return undefined
  return students.find(
    (s) =>
      (s.nisn && norm(s.nisn) === key) ||
      (s.nis && norm(s.nis) === key) ||
      norm(s.registration_code) === key ||
      norm(s.name) === key,
  )?.id
}

/** Update foto siswa secara massal — nama file dicocokkan ke NISN/kode/nama */
export function PhotoModal({ open, onClose }: PhotoModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [entries, setEntries] = useState<PhotoEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const updatePhotoMutation = useUpdateStudentPhoto()

  // ambil semua siswa aktif untuk pencocokan
  const studentsQuery = useStudents({ page: 1, pageSize: 1000 }, { enabled: open })
  const students = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data])

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        value: s.id,
        label: `${s.name}${s.nisn ? ` · ${s.nisn}` : ''}${s.classes?.name ? ` · ${s.classes.name}` : ''}`,
      })),
    [students],
  )

  // ─── Status per entri ──────────────────────────────────────────────────────
  // Duplikat = entri ke-2+ dengan siswa sama (yang pertama menang, sisanya
  // dikecualikan dari upload agar tidak saling menimpa)
  const duplicateUidSet = useMemo(() => {
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const e of entries) {
      if (!e.studentId) continue
      if (seen.has(e.studentId)) dups.add(e.uid)
      else seen.add(e.studentId)
    }
    return dups
  }, [entries])

  const isDuplicate = (entry: PhotoEntry) => duplicateUidSet.has(entry.uid)

  const stateOf = (entry: PhotoEntry): 'success' | 'error' | 'duplicate' | 'unmatched' | 'matched' => {
    if (entry.status === 'success') return 'success'
    if (isDuplicate(entry)) return 'duplicate'
    if (!entry.studentId) return 'unmatched'
    if (entry.status === 'error') return 'error'
    return 'matched'
  }

  /** Perlu perhatian: belum teridentifikasi, duplikat, atau gagal */
  const needsReview = (entry: PhotoEntry) =>
    stateOf(entry) === 'unmatched' || stateOf(entry) === 'duplicate' || stateOf(entry) === 'error'

  /** Target upload: teridentifikasi, belum sukses, bukan duplikat */
  const targets = useMemo(
    () => entries.filter((e) => e.studentId && e.status !== 'success' && !isDuplicate(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, duplicateUidSet],
  )

  const errorCount = entries.filter((e) => stateOf(e) === 'error').length
  const successCount = entries.filter((e) => e.status === 'success').length
  const reviewCount = entries.filter(needsReview).length
  const allFailed = targets.length > 0 && targets.every((t) => t.status === 'error')

  const visibleEntries = filter === 'all' ? entries : entries.filter(needsReview)

  // ─── Aksi ──────────────────────────────────────────────────────────────────
  const handleBeforeUpload = (file: File) => {
    const studentId = autoMatch(file.name, students)
    setEntries((prev) => [
      ...prev,
      {
        uid: `${file.name}-${file.lastModified}-${prev.length}`,
        fileName: file.name,
        file,
        previewUrl: URL.createObjectURL(file),
        studentId,
        matched: studentId !== undefined,
        status: 'idle',
      },
    ])
    return false // cegah upload otomatis antd
  }

  const handleRemove = (uid: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.uid === uid)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((e) => e.uid !== uid)
    })
  }

  const handleRemoveUnmatched = () => {
    setEntries((prev) => {
      prev.forEach((e) => {
        if (needsReview(e) && stateOf(e) !== 'error') URL.revokeObjectURL(e.previewUrl)
      })
      return prev.filter((e) => !needsReview(e) || stateOf(e) === 'error')
    })
  }

  const handleClear = () => {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl))
    setEntries([])
  }

  const handleClose = () => {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl))
    setEntries([])
    setProgress(null)
    setFilter('all')
    onClose()
  }

  /** Upload berurutan dengan status per entri — yang gagal TETAP di daftar
      lengkap dengan pesan errornya supaya bisa diperbaiki lalu di-retry. */
  const runUpload = async (list: PhotoEntry[]) => {
    if (list.length === 0) return
    setUploading(true)
    setProgress({ done: 0, total: list.length })
    const targetUids = new Set(list.map((t) => t.uid))
    setEntries((prev) =>
      prev.map((e) =>
        targetUids.has(e.uid) ? { ...e, status: 'uploading', error: undefined } : e,
      ),
    )

    let ok = 0
    let fail = 0
    for (const target of list) {
      try {
        const photoUrl = await compressImage(target.file)
        await updatePhotoMutation.mutateAsync({ id: target.studentId!, photoUrl })
        ok += 1
        setEntries((prev) =>
          prev.map((e) => (e.uid === target.uid ? { ...e, status: 'success', error: undefined } : e)),
        )
      } catch (err) {
        fail += 1
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui foto'
        setEntries((prev) => prev.map((e) => (e.uid === target.uid ? { ...e, status: 'error', error: msg } : e)))
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }

    setUploading(false)
    setProgress(null)
    if (fail === 0) message.success(`${ok} foto berhasil diperbarui`)
    else message.warning(`${ok} berhasil, ${fail} gagal, perbaiki lalu coba lagi`)
  }

  const handlePrimary = () => void runUpload(targets)

  // ─── Render ────────────────────────────────────────────────────────────────
  const stateBadge = (entry: PhotoEntry) => {
    // Sedang mengunggah → badge spinner, di luar klasifikasi stateOf
    if (entry.status === 'uploading') {
      return (
        <Tag color="processing" icon={<LoadingOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
          Mengunggah…
        </Tag>
      )
    }
    const state = stateOf(entry)
    const student = entry.studentId ? students.find((s) => s.id === entry.studentId) : null
    switch (state) {
      case 'matched':
        return (
          <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {student?.name ?? 'Cocok'}
          </Tag>
        )
      case 'unmatched':
        return (
          <Tag color="orange" icon={<WarningOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            Belum teridentifikasi
          </Tag>
        )
      case 'duplicate':
        return (
          <Tooltip title="Siswa sama dengan foto lain di daftar: foto pertama yang dipakai">
            <Tag color="red" icon={<WarningOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
              Duplikat
            </Tag>
          </Tooltip>
        )
      case 'success':
        return (
          <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            Berhasil
          </Tag>
        )
      case 'error':
        return (
          <Tooltip title={entry.error ?? 'Gagal memperbarui foto'}>
            <Tag color="red" icon={<WarningOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
              Gagal
            </Tag>
          </Tooltip>
        )
    }
  }

  const rowBorder = (entry: PhotoEntry) => {
    const state = stateOf(entry)
    if (state === 'success') return token.colorSuccessBorder
    if (state === 'error' || state === 'duplicate') return token.colorErrorBorder
    return token.colorBorderSecondary
  }

  const footerSummary = () => {
    if (uploading && progress) return `Mengunggah ${progress.done}/${progress.total}…`
    if (entries.length === 0) return ' '
    if (allFailed) return `${targets.length} foto gagal, coba lagi`
    const parts = [`${targets.length} dari ${entries.length} foto siap diperbarui`]
    if (errorCount > 0) parts.push(`${errorCount} gagal`)
    if (reviewCount > 0) parts.push(`${reviewCount} perlu ditinjau`)
    return parts.join(' · ')
  }

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      width={720}
      icon={<CameraOutlined />}
      title="Bulk Foto"
      subtitle="Update foto siswa secara massal via NISN"
      footer={
        <ModalFooter
          left={<Text type="secondary" style={{ fontSize: 12 }}>{footerSummary()}</Text>}
          onCancel={handleClose}
          cancelText="Tutup"
          onOk={handlePrimary}
          okText={allFailed ? `Coba Lagi (${targets.length})` : `Perbarui ${targets.length > 0 ? `${targets.length} ` : ''}Foto`}
          okDisabled={targets.length === 0}
          okLoading={uploading}
        />
      }
    >
      {/* Dropzone — menyusut jadi satu baris saat daftar sudah terisi */}
      {entries.length === 0 ? (
        <div style={{ marginBottom: 12 }}>
          <UploadDropzone
            multiple
            accept="image/*"
            disabled={uploading}
            title="Klik atau seret foto ke sini"
            hint="Nama file dicocokkan otomatis ke NISN, NIS, kode registrasi, atau nama siswa, contoh: 0086230011.jpg atau Ahmad Fauzi.jpg"
            beforeUpload={(file) => {
              handleBeforeUpload(file)
              return false
            }}
          />
        </div>
      ) : (
        <Upload.Dragger
          multiple
          accept="image/*"
          showUploadList={false}
          disabled={uploading}
          beforeUpload={(file) => {
            handleBeforeUpload(file)
            return false
          }}
          style={{ marginBottom: 12 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '2px 0',
              color: token.colorTextSecondary,
              fontSize: 13,
            }}
          >
            <PlusOutlined />
            Tambah foto lagi, klik atau seret ke sini
          </div>
        </Upload.Dragger>
      )}

      {/* Progress agregat */}
      {progress && (
        <div style={{ marginBottom: 12 }}>
          <Progress
            percent={Math.round((progress.done / progress.total) * 100)}
            size="small"
            status="active"
          />
        </div>
      )}

      {/* Bar statistik + kontrol — hanya saat ada entri */}
      {entries.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag style={{ borderRadius: 999 }}>Total {entries.length}</Tag>
            <Tag color="green" style={{ borderRadius: 999 }}>
              Siap {targets.length}
            </Tag>
            {reviewCount > 0 && (
              <Tag color="orange" style={{ borderRadius: 999 }}>
                Perlu ditinjau {reviewCount}
              </Tag>
            )}
            {successCount > 0 && (
              <Tag color="green" style={{ borderRadius: 999 }}>
                Berhasil {successCount}
              </Tag>
            )}
            {errorCount > 0 && (
              <Tag color="red" style={{ borderRadius: 999 }}>
                Gagal {errorCount}
              </Tag>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Segmented
              size="small"
              value={filter}
              onChange={(v) => setFilter(v as 'all' | 'review')}
              options={[
                { value: 'all', label: 'Semua' },
                { value: 'review', label: `Perlu ditinjau${reviewCount > 0 ? ` (${reviewCount})` : ''}` },
              ]}
            />
            {reviewCount > 0 && (
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                disabled={uploading}
                onClick={handleRemoveUnmatched}
              >
                Hapus perlu ditinjau
              </Button>
            )}
            <Button size="small" type="text" danger icon={<CloseOutlined />} disabled={uploading} onClick={handleClear}>
              Kosongkan
            </Button>
          </div>
        </div>
      )}

      {/* Daftar foto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleEntries.map((entry) => {
          const state = stateOf(entry)
          const student = entry.studentId ? students.find((s) => s.id === entry.studentId) : null
          const locked = entry.status === 'success' || entry.status === 'uploading'
          return (
            <div
              key={entry.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${rowBorder(entry)}`,
                background: entry.status === 'success' ? token.colorSuccessBg : undefined,
                opacity: state === 'duplicate' ? 0.75 : undefined,
              }}
            >
              <img
                src={entry.previewUrl}
                alt={entry.fileName}
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flexShrink: 1,
                    }}
                  >
                    {entry.fileName}
                  </span>
                  {stateBadge(entry)}
                </div>
                <Select
                  size="small"
                  showSearch
                  allowClear
                  placeholder="Pilih siswa"
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  value={entry.studentId}
                  disabled={locked}
                  options={studentOptions}
                  onChange={(v) =>
                    setEntries((prev) =>
                      prev.map((e) =>
                        e.uid === entry.uid
                          ? { ...e, studentId: v, matched: v !== undefined, status: 'idle', error: undefined }
                          : e,
                      ),
                    )
                  }
                />
                {entry.status === 'error' && entry.error && (
                  <div style={{ fontSize: 11.5, color: token.colorError, marginTop: 3 }}>{entry.error}</div>
                )}
                {state === 'duplicate' && student && (
                  <div style={{ fontSize: 11.5, color: token.colorError, marginTop: 3 }}>
                    Duplikat dari foto lain untuk {student.name}
                  </div>
                )}
              </div>
              <Tooltip title="Hapus dari daftar">
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  disabled={uploading}
                  onClick={() => handleRemove(entry.uid)}
                  style={{ flexShrink: 0 }}
                />
              </Tooltip>
            </div>
          )
        })}

        {entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: token.colorTextTertiary }}>
            <UserOutlined style={{ fontSize: 26, display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>Belum ada foto yang dipilih</div>
            <div style={{ marginTop: 4, fontSize: 12.5 }}>
              Pilih foto untuk mulai memetakan ke NISN siswa. JPG atau PNG, dikompres otomatis di bawah 450 KB.
            </div>
          </div>
        )}

        {entries.length > 0 && visibleEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: token.colorTextTertiary, fontSize: 13 }}>
            Tidak ada foto yang perlu ditinjau, semua siap
          </div>
        )}
      </div>
    </AppModal>
  )
}
