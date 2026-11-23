import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Drawer,
  Grid,
  List,
  Popover,
  Progress,
  Select,
  Spin,
  Tag,
  Timeline,
} from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import { pageShellItemVariants, shellTransition } from '../../../shared/motion'
import {
  AuditOutlined,
  EditOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  IdcardOutlined,
  LoginOutlined,
  LogoutOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { updateStudentTags } from '../api'
import { useStudentOverview } from '../useStudentOverview'
import { completenessPercent, missingFieldsOf } from '../completeness'
import { useStudentGuardians, useStudentPhotos, useUpdateStudentPhoto } from '../hooks'
import { WA_TEMPLATES, renderWaMessage, waLink } from '../wa'
import type { Student } from '../types'
import { compressImage } from '../../../shared/utils/imageCompress'
import { DetailHeader } from './DetailHeader'
import { DetailInfoTab } from './DetailInfoTab'
import { DetailBehaviorTab, TabEmpty, type PointFilter } from './DetailBehaviorTab'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

type ProfileTab = 'info' | 'perilaku' | 'report-card' | 'gerbang' | 'audit'

const SCORE_KEYS = [
  { key: 'character_score', label: 'Akhlak', color: '#f59e0b' },
  { key: 'worship_score', label: 'Ibadah', color: '#4f46e5' },
  { key: 'cleanliness_score', label: 'Bersih', color: '#10b981' },
  { key: 'quran_score', label: 'Quran', color: '#0ea5e9' },
  { key: 'language_score', label: 'Bhs', color: '#7c3aed' },
] as const

function auditActionMeta(action: string): { label: string; color: string; bg: string } {
  const a = action.toUpperCase()
  if (a === 'INSERT') return { label: 'Buat', color: '#059669', bg: '#ecfdf5' }
  if (a === 'UPDATE') return { label: 'Ubah', color: '#d97706', bg: '#fffbeb' }
  if (a === 'DELETE') return { label: 'Hapus', color: '#dc2626', bg: '#fef2f2' }
  return { label: a, color: '#64748b', bg: '#f1f5f9' }
}

// ------------------------------------------------------------
// Popover Label: edit tags cepat tanpa buka form edit
// ------------------------------------------------------------

function LabelPopover({ student, tags, onSaved }: { student: Student; tags: string[]; onSaved: (tags: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string[]>(tags)
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) setValue(tags)
  }, [open, tags])

  const save = async () => {
    setSaving(true)
    try {
      await updateStudentTags(student.id, value)
      onSaved(value)
      queryClient.invalidateQueries({ queryKey: ['students', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['students', 'detail', student.id] })
      queryClient.invalidateQueries({ queryKey: ['student-stats'] })
      message.success('Label berhasil disimpan')
      setOpen(false)
    } catch {
      message.error('Gagal menyimpan label')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="topLeft"
      content={
        <div style={{ width: 240 }}>
          <Select
            mode="tags"
            value={value}
            onChange={setValue}
            placeholder="Ketik tag lalu Enter"
            tokenSeparators={[',']}
            style={{ width: '100%' }}
            size="small"
          />
          <Button type="primary" size="small" block loading={saving} onClick={save} style={{ marginTop: 8 }}>
            Simpan Label
          </Button>
        </div>
      }
    >
      <Button icon={<TagsOutlined />}>Label</Button>
    </Popover>
  )
}

// ------------------------------------------------------------
// Drawer utama: header ringan + rail navigasi vertikal + konten
// ------------------------------------------------------------

interface DetailDrawerProps {
  open: boolean
  student: Student | null
  onClose: () => void
  /** opsional — bila tidak diberikan, tombol Edit Data disembunyikan (mis. halaman Alumni) */
  onEdit?: (student: Student) => void
  /** mode privasi: sembunyikan kode / NISN / NIK / nomor telepon */
  isPrivacyMode?: boolean
  /** banner opsional di atas header identitas (mis. peringatan status arsip) */
  notice?: ReactNode
}

export function DetailDrawer({ open, student, onClose, onEdit, isPrivacyMode = false, notice }: DetailDrawerProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const gridCols = isMobile ? '1fr' : '1fr 1fr'

  const { canWrite } = usePermissions()
  const { message } = App.useApp()
  const [tab, setTab] = useState<ProfileTab>('info')
  const [visibleLogs, setVisibleLogs] = useState(8)
  const [pointFilter, setPointFilter] = useState<PointFilter>('all')
  // override tags lokal agar header ikut berubah setelah popover Label disimpan
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null)

  const studentId = student?.id ?? null

  useEffect(() => {
    setTab('info')
    setVisibleLogs(8)
    setPointFilter('all')
    setTagsOverride(null)
  }, [studentId])

  // A1: Foto lazy untuk drawer
  const photosQuery = useStudentPhotos(open && studentId ? [studentId] : [])
  const studentPhoto = student?.photo_url ?? photosQuery.data?.[studentId ?? '']

  // D4: Upload foto per-siswa klik avatar di drawer
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updatePhotoMutation = useUpdateStudentPhoto()

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !student) return
    try {
      message.loading({ content: 'Mengompres foto...', key: 'upload-photo' })
      const photoUrl = await compressImage(file)
      await updatePhotoMutation.mutateAsync({ id: student.id, photoUrl })
      message.success({ content: 'Foto profil berhasil diperbarui', key: 'upload-photo' })
    } catch (err) {
      message.error({
        content: err instanceof Error ? err.message : 'Gagal mengunggah foto',
        key: 'upload-photo',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Ringkasan lintas-modul (poin, raport, gate, audit) — satu hook bersama
  // C8: Gate query per tab aktif
  const { reportsQuery, reportCardQuery, gateQuery, auditQuery } = useStudentOverview(
    studentId ?? undefined,
    {
      enabled: open && !!studentId,
      reports: tab === 'perilaku',
      reportCard: tab === 'report-card',
      gate: tab === 'gerbang',
      audit: tab === 'audit',
    },
  )

  // Data ayah/ibu/wali (student_guardians, 0020) — RLS hanya admin/pengurus;
  // bila query gagal (mis. role guru) section ini saja yang disembunyikan
  const guardiansQuery = useStudentGuardians(studentId, open)

  const reports = reportsQuery.data ?? []
  const reportCardRows = reportCardQuery.data ?? []
  const gateLogs = gateQuery.data ?? []
  const auditLogs = auditQuery.data?.data ?? []
  const guardians = guardiansQuery.data ?? []

  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = dayjs().subtract(5 - i, 'month')
      return { key: d.format('YYYY-MM'), label: MONTHS_ID[d.month()], positif: 0, negatif: 0 }
    })
    for (const r of reports) {
      const bucket = months.find((m) => m.key === dayjs(r.reported_at).format('YYYY-MM'))
      if (!bucket) continue
      if (r.points > 0) bucket.positif += r.points
      else if (r.points < 0) bucket.negatif += Math.abs(r.points)
    }
    return months
  }, [reports])

  if (!student) return null

  const tags = tagsOverride ?? student.tags ?? []
  const points = student.total_points ?? 0
  const canEditData = canWrite && !isPrivacyMode && !!onEdit
  const goEdit = () => {
    onClose()
    onEdit?.(student)
  }

  const missingFields = missingFieldsOf({ ...student, photo_url: studentPhoto ?? null })
  const completeness = completenessPercent({ ...student, photo_url: studentPhoto ?? null })

  const openWa = () => {
    if (!student.phone) return
    const tpl = WA_TEMPLATES.find((t) => t.id === 'report')
    window.open(waLink(student.phone, renderWaMessage(tpl?.body ?? '', student)), '_blank')
  }

  const saveVcf = () => {
    if (isPrivacyMode) {
      message.warning('Mode privasi aktif, data disembunyikan')
      return
    }
    if (!student.phone) {
      message.error('Nomor WA kosong')
      return
    }
    const guardian = student.guardian_name || 'Ortu'
    const clean = student.phone.replace(/\D/g, '')
    const intl = clean.startsWith('0') ? `+62${clean.slice(1)}` : `+${clean}`
    const vcf = `BEGIN:VCARD
VERSION:3.0
FN:Wali - ${student.name} (${guardian})
TEL;TYPE=CELL:${intl}
END:VCARD`
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Wali_${student.name.replace(/s+/g, '_')}.vcf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('Kontak VCF berhasil diunduh')
  }

  const handlePointFilterChange = (v: PointFilter) => {
    setPointFilter(v)
    setVisibleLogs(8)
  }

  const railItems: { id: ProfileTab; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'info', label: 'Info', icon: <IdcardOutlined /> },
    { id: 'perilaku', label: 'Perilaku', icon: <HistoryOutlined />, count: reports.length },
    { id: 'report-card', label: 'Rapor', icon: <FileDoneOutlined />, count: reportCardRows.length },
    { id: 'gerbang', label: 'Gerbang', icon: <LoginOutlined />, count: gateLogs.length },
    { id: 'audit', label: 'Audit', icon: <AuditOutlined />, count: auditLogs.length },
  ]

  return (
    <Drawer
      title="Profil Santri"
      open={open}
      onClose={onClose}
      size="min(720px, 96vw)"
      destroyOnHidden
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canWrite && <LabelPopover student={student} tags={tags} onSaved={setTagsOverride} />}
          <div style={{ flex: 1 }} />
          <Button onClick={onClose}>Tutup</Button>
          {canEditData && (
            <Button type="primary" icon={<EditOutlined />} onClick={goEdit}>
              Edit Data
            </Button>
          )}
        </div>
      }
    >
      <motion.div
        variants={pageShellItemVariants}
        initial="initial"
        animate="animate"
        transition={shellTransition}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
      {notice}
      {/* ── Header low: identitas + ring kelengkapan + ringkasan domisili ── */}
      <DetailHeader
        student={student}
        studentPhoto={studentPhoto}
        isPrivacyMode={isPrivacyMode}
        tags={tags}
        points={points}
        canWrite={canWrite}
        missingFields={missingFields}
        completeness={completeness}
        photoInputRef={fileInputRef}
        onPhotoUpload={handlePhotoUpload}
      />

       {/* ── Rail navigasi kiri + konten kanan ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <nav
          style={{
            width: isMobile ? 64 : 148,
            flexShrink: 0,
            background: '#f8fafc',
            borderRight: '1px solid #eef2f7',
            padding: isMobile ? '12px 8px' : 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
          role="tablist"
          aria-label="Profil tabs"
        >
          {railItems.map((item) => {
            const active = tab === item.id
            const countLabel =
              item.count != null &&
              item.count >= (item.id === 'gerbang' ? 20 : item.id === 'audit' ? 50 : 100)
                ? `${item.count}+`
                : item.count

            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                aria-controls={`drawer-tab-${item.id}`}
                id={`drawer-nav-${item.id}`}
                onClick={() => {
                  setTab(item.id)
                  setVisibleLogs(8)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMobile ? 'center' : 'flex-start',
                  gap: isMobile ? 0 : 9,
                  width: '100%',
                  padding: isMobile ? '10px 0' : '10px 12px',
                  borderRadius: 11,
                  border: 'none',
                  background: active ? '#eef2ff' : 'transparent',
                  color: active ? '#4f46e5' : '#475569',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                title={isMobile ? item.label : undefined}
              >
                <span style={{ fontSize: 16, display: 'inline-flex' }}>{item.icon}</span>
                {!isMobile && (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 600 }}>
                    {item.label}
                  </span>
                )}
                {countLabel != null && countLabel !== 0 && (
                  <span
                    style={{
                      fontSize: isMobile ? 9 : 11,
                      fontWeight: 700,
                      lineHeight: isMobile ? '14px' : '18px',
                      padding: isMobile ? '0 4px' : '0 7px',
                      borderRadius: 9,
                      background: active ? '#fff' : '#e2e8f0',
                      color: active ? '#4f46e5' : '#64748b',
                      position: isMobile ? 'absolute' : 'static',
                      top: isMobile ? 6 : undefined,
                      right: isMobile ? 6 : undefined,
                    }}
                  >
                    {countLabel}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div
          id={`drawer-tab-${tab}`}
          role="tabpanel"
          aria-labelledby={`drawer-nav-${tab}`}
          style={{ flex: 1, minWidth: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '0 22px 24px' }}
        >
          {/* ── INFO ── */}
          {tab === 'info' && (
            <DetailInfoTab
              student={student}
              isPrivacyMode={isPrivacyMode}
              gridCols={gridCols}
              canEditData={canEditData}
              goEdit={goEdit}
              openWa={openWa}
              saveVcf={saveVcf}
              guardians={guardians}
              guardiansSuccess={guardiansQuery.isSuccess}
              tags={tags}
            />
          )}

          {/* ── PERILAKU ── */}
          {tab === 'perilaku' && (
            <DetailBehaviorTab
              studentId={student.id}
              reports={reports}
              reportsPending={reportsQuery.isPending}
              points={points}
              chartData={chartData}
              pointFilter={pointFilter}
              onPointFilterChange={handlePointFilterChange}
              visibleLogs={visibleLogs}
              onLoadMore={() => setVisibleLogs((v) => v + 8)}
            />
          )}

          {/* ── RAPORT ── */}
          {tab === 'report-card' &&
            (reportCardQuery.isPending ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : reportCardRows.length === 0 ? (
              <TabEmpty title="Arsip raport kosong" description="Data raport bulanan untuk siswa ini belum tersedia." />
            ) : (
              reportCardRows.map((r) => {
                const values = SCORE_KEYS.map((k) => r[k.key]).filter((v): v is number => v != null)
                const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null
                return (
                  <Card
                    key={r.id}
                    size="small"
                    style={{ marginTop: 20, borderRadius: 13 }}
                    styles={{ body: { padding: '10px 16px 14px' } }}
                    title={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Tag color="geekblue" style={{ borderRadius: 6, marginInlineEnd: 0 }}>
                          Bln {r.month}
                        </Tag>
                        <span style={{ fontSize: 14.5 }}>Rapor Bulanan {r.year}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: '#94a3b8' }}>{r.musyrif_name ?? ''}</span>
                      </span>
                    }
                    extra={
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5' }}>{avg ?? '-'}</span>
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8' }}>Rerata</span>
                      </span>
                    }
                  >
                    {SCORE_KEYS.map((k) => {
                      const v = r[k.key]
                      return (
                        <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                          <span style={{ width: 70, fontSize: 12.5, fontWeight: 600, color: '#475569', flexShrink: 0 }}>{k.label}</span>
                          <Progress
                            percent={v != null ? Math.min(100, Math.round((v / 10) * 100)) : 0}
                            strokeColor={k.color}
                            size="small"
                            format={() => (v != null ? String(v) : '–')}
                            style={{ flex: 1, marginBottom: 0 }}
                          />
                        </div>
                      )
                    })}
                  </Card>
                )
              })
            ))}

          {/* ── GERBANG ── */}
          {tab === 'gerbang' &&
            (gateQuery.isPending ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : gateLogs.length === 0 ? (
              <TabEmpty title="Belum ada aktivitas gerbang" description="Santri ini belum memiliki catatan masuk/keluar di gerbang." />
            ) : (
              <List
                style={{ marginTop: 12 }}
                dataSource={gateLogs}
                renderItem={(g) => {
                  const isExit = g.direction === 'exit'
                  return (
                    <List.Item style={{ padding: '10px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: isExit ? '#fff7ed' : '#ecfdf5',
                            color: isExit ? '#ea580c' : '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {isExit ? <LogoutOutlined /> : <LoginOutlined />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{dayjs(g.occurred_at).format('DD MMM YYYY · HH:mm')}</div>
                          {g.recorder?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{g.recorder.name}</div>}
                        </div>
                        <Tag color={isExit ? 'orange' : 'green'} style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                          {isExit ? 'Keluar' : 'Masuk'}
                        </Tag>
                      </div>
                    </List.Item>
                  )
                }}
              />
            ))}

          {/* ── AUDIT ── */}
          {tab === 'audit' &&
            (auditQuery.isPending ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : auditLogs.length === 0 ? (
              <TabEmpty title="Belum ada riwayat audit" description="Perubahan data siswa ini akan tercatat di sini." />
            ) : (
              <Timeline
                style={{ marginTop: 20 }}
                items={auditLogs.map((log) => {
                  const meta = auditActionMeta(log.action)
                  return {
                    dot: <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: meta.color }} />,
                    children: (
                      <div style={{ paddingBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Tag style={{ marginInlineEnd: 0, borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: meta.color, background: meta.bg, borderColor: 'transparent' }}>
                            {meta.label}
                          </Tag>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{log.actor_name ?? 'Sistem'}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{dayjs(log.created_at).format('DD MMM YYYY HH:mm')}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Sumber: {log.source}</div>
                      </div>
                    ),
                  }
                })}
              />
            ))}
        </div>
      </div>
      </motion.div>
    </Drawer>
  )
}
