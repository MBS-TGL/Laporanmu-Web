import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  List,
  Popover,
  Progress,
  Row,
  Segmented,
  Select,
  Spin,
  Statistic,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import {
  AuditOutlined,
  BookOutlined,
  CheckOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  HomeOutlined,
  IdcardOutlined,
  LoginOutlined,
  LogoutOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { fetchReportsByStudent } from '../../behavior/api'
import { fetchGateLogsByStudent } from '../../gate/api'
import { fetchAuditLogs } from '../../admin/api'
import { fetchMonthlyRowsByStudent } from '../../raport/api'
import { updateStudentTags } from '../api'
import { GENDER_LABEL, STUDENT_STATUS_META } from '../status'
import { WA_TEMPLATES, renderWaMessage, waLink } from '../wa'
import type { Student } from '../types'

const MASK = '••••••'
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

type ProfileTab = 'info' | 'perilaku' | 'raport' | 'gerbang' | 'audit'

const NILAI_KEYS = [
  { key: 'nilai_akhlak', label: 'Akhlak', color: '#f59e0b' },
  { key: 'nilai_ibadah', label: 'Ibadah', color: '#4f46e5' },
  { key: 'nilai_kebersihan', label: 'Bersih', color: '#10b981' },
  { key: 'nilai_quran', label: 'Quran', color: '#0ea5e9' },
  { key: 'nilai_bahasa', label: 'Bhs', color: '#7c3aed' },
] as const

/** Field yang dihitung untuk persentase kelengkapan data */
const FIELD_CHECKS: { label: string; test: (s: Student) => boolean }[] = [
  { label: 'Foto', test: (s) => !!s.photo_url },
  { label: 'NISN', test: (s) => !!s.nisn },
  { label: 'NIS', test: (s) => !!s.nis },
  { label: 'NIK', test: (s) => !!s.nik },
  { label: 'Telepon', test: (s) => !!s.phone },
  { label: 'Alamat', test: (s) => !!s.address },
  { label: 'Tempat lahir', test: (s) => !!s.birth_place },
  { label: 'Tanggal lahir', test: (s) => !!s.birth_date },
  { label: 'Agama', test: (s) => !!s.religion },
  { label: 'Nama wali', test: (s) => !!s.guardian_name },
  { label: 'Label', test: (s) => !!s.tags?.length },
]

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

function auditActionMeta(action: string): { label: string; color: string; bg: string } {
  const a = action.toUpperCase()
  if (a === 'INSERT') return { label: 'Buat', color: '#059669', bg: '#ecfdf5' }
  if (a === 'UPDATE') return { label: 'Ubah', color: '#d97706', bg: '#fffbeb' }
  if (a === 'DELETE') return { label: 'Hapus', color: '#dc2626', bg: '#fef2f2' }
  return { label: a, color: '#64748b', bg: '#f1f5f9' }
}

// ------------------------------------------------------------
// Elemen UI kecil
// ------------------------------------------------------------

/** Judul section memakai Divider bawaan AntD (orientasi kiri) */
function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <Divider orientation="left" orientationMargin={0} style={{ margin: '24px 0 14px', borderColor: '#eef2f7' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{children}</span>
        {extra}
      </span>
    </Divider>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 500, color: '#0f172a' }}>{children}</div>
    </div>
  )
}

function StatPill({ icon, label, value, color }: { icon: ReactNode; label: string; value: ReactNode; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 13,
        background: '#f8fafc',
        border: '1px solid #eef2f7',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: `${color}14`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{label}</div>
      </div>
    </div>
  )
}

function TabEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ paddingTop: 56, textAlign: 'center' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
            <span style={{ display: 'block', fontSize: 13.5, color: '#94a3b8', marginTop: 3 }}>{description}</span>
          </span>
        }
      />
    </div>
  )
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
      queryClient.invalidateQueries({ queryKey: ['students'] })
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
}

export function DetailDrawer({ open, student, onClose, onEdit, isPrivacyMode = false }: DetailDrawerProps) {
  const { canWrite } = usePermissions()
  const { message } = App.useApp()
  const [tab, setTab] = useState<ProfileTab>('info')
  const [visibleLogs, setVisibleLogs] = useState(8)
  const [pointFilter, setPointFilter] = useState<'all' | 'pos' | 'neg'>('all')
  // override tags lokal agar header ikut berubah setelah popover Label disimpan
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null)

  const studentId = student?.id ?? null

  useEffect(() => {
    setTab('info')
    setVisibleLogs(8)
    setPointFilter('all')
    setTagsOverride(null)
  }, [studentId])

  const reportsQuery = useQuery({
    queryKey: ['behavior-reports', 'student', studentId],
    queryFn: () => fetchReportsByStudent(studentId!, 100),
    enabled: open && !!studentId,
  })

  const raportQuery = useQuery({
    queryKey: ['raport-monthly', 'student', studentId],
    queryFn: () => fetchMonthlyRowsByStudent(studentId!),
    enabled: open && !!studentId,
  })

  const gateQuery = useQuery({
    queryKey: ['gate-logs', 'student', studentId],
    queryFn: () => fetchGateLogsByStudent(studentId!, 20),
    enabled: open && !!studentId,
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', 'student', studentId],
    queryFn: () => fetchAuditLogs({ tableName: 'students', recordId: studentId!, page: 1, pageSize: 50 }),
    enabled: open && !!studentId,
  })

  const reports = reportsQuery.data ?? []
  const raportRows = raportQuery.data ?? []
  const gateLogs = gateQuery.data ?? []
  const auditLogs = auditQuery.data?.data ?? []

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

  const mask = (value: string | null) => (isPrivacyMode && value ? MASK : (value ?? '—'))
  const copyable = (value: string | null) =>
    value && !isPrivacyMode ? { text: value, tooltips: ['Salin', 'Tersalin'] as [string, string] } : false

  const tags = tagsOverride ?? student.tags ?? []
  const points = student.total_points ?? 0
  const canEditData = canWrite && !isPrivacyMode && !!onEdit
  const goEdit = () => {
    onClose()
    onEdit?.(student)
  }

  const missingFields = FIELD_CHECKS.filter((f) => !f.test(student)).map((f) => f.label)
  const completeness = Math.round(((FIELD_CHECKS.length - missingFields.length) / FIELD_CHECKS.length) * 100)

  const posCount = reports.filter((r) => r.points > 0).length
  const negCount = reports.filter((r) => r.points < 0).length
  const filteredCount = pointFilter === 'all' ? reports.length : reports.filter((r) => (pointFilter === 'pos' ? r.points > 0 : r.points < 0)).length
  const filteredReports = (pointFilter === 'all' ? reports : reports.filter((r) => (pointFilter === 'pos' ? r.points > 0 : r.points < 0))).slice(
    0,
    visibleLogs,
  )

  const openWa = () => {
    if (!student.phone) return
    const tpl = WA_TEMPLATES.find((t) => t.id === 'laporan')
    window.open(waLink(student.phone, renderWaMessage(tpl?.body ?? '', student)), '_blank')
  }

  const saveVcf = () => {
    if (isPrivacyMode) {
      message.warning('Mode privasi aktif — data disembunyikan')
      return
    }
    if (!student.phone) {
      message.error('Nomor WA kosong')
      return
    }
    const guardian = student.guardian_name || 'Ortu'
    const clean = student.phone.replace(/\D/g, '')
    const intl = clean.startsWith('0') ? `+62${clean.slice(1)}` : `+${clean}`
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:Wali - ${student.name} (${guardian})\nTEL;TYPE=CELL:${intl}\nEND:VCARD`
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Wali_${student.name.replace(/\s+/g, '_')}.vcf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('Kontak VCF berhasil diunduh')
  }

  const railItems: { id: ProfileTab; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'info', label: 'Info', icon: <IdcardOutlined /> },
    { id: 'perilaku', label: 'Perilaku', icon: <HistoryOutlined />, count: reports.length },
    { id: 'raport', label: 'Raport', icon: <FileDoneOutlined />, count: raportRows.length },
    { id: 'gerbang', label: 'Gerbang', icon: <LoginOutlined />, count: gateLogs.length },
    { id: 'audit', label: 'Audit', icon: <AuditOutlined />, count: auditLogs.length },
  ]

  const ttl = [student.birth_place, student.birth_date ? dayjs(student.birth_date).format('DD MMM YYYY') : null]
    .filter(Boolean)
    .join(', ')

  return (
    <Drawer
      title="Profil Siswa"
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
      {/* ── Header ringan: identitas + ring kelengkapan + ringkasan domisili ── */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #eef2f7', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {student.photo_url && !isPrivacyMode ? (
              <img src={student.photo_url} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials(student.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {student.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <StatusTag color={STUDENT_STATUS_META[student.status].color} icon={STUDENT_STATUS_META[student.status].icon}>
                {STUDENT_STATUS_META[student.status].label}
              </StatusTag>
              <Typography.Text type="secondary" copyable={copyable(student.registration_code)} style={{ fontSize: 13.5 }}>
                {mask(student.registration_code)}
              </Typography.Text>
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {tags.map((t) => (
                    <Tag key={t} style={{ borderRadius: 7, fontSize: 11.5, lineHeight: '18px', padding: '0 8px', marginInlineEnd: 0 }}>
                    {t}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          <Tooltip title={missingFields.length > 0 ? `Belum lengkap: ${missingFields.join(', ')}` : 'Semua data sudah lengkap'}>
            <Progress
              type="circle"
              percent={completeness}
              size={64}
              strokeColor="#4f46e5"
              strokeWidth={10}
              format={(p) => (p === 100 ? <CheckOutlined style={{ color: '#16a34a' }} /> : <span style={{ fontSize: 14, fontWeight: 700 }}>{p}%</span>)}
            />
          </Tooltip>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <StatPill icon={<ThunderboltOutlined />} label="Total Poin" value={points > 0 ? `+${points}` : points} color={points < 0 ? '#ef4444' : '#10b981'} />
          <StatPill icon={<BookOutlined />} label="Kelas" value={student.classes?.name ?? student.last_class?.name ?? '—'} color="#4f46e5" />
          <StatPill icon={<HomeOutlined />} label="Asrama" value={student.dorms?.name ?? 'Tanpa asrama'} color="#0ea5e9" />
        </div>
      </div>

      {/* ── Rail navigasi kiri + konten kanan ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <nav
          style={{
            width: 148,
            flexShrink: 0,
            background: '#f8fafc',
            borderRight: '1px solid #eef2f7',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {railItems.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id)
                  setVisibleLogs(8)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 11,
                  border: 'none',
                  background: active ? '#eef2ff' : 'transparent',
                  color: active ? '#4f46e5' : '#475569',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 16, display: 'inline-flex' }}>{item.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 600 }}>{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: '18px',
                      padding: '0 7px',
                      borderRadius: 9,
                      background: active ? '#fff' : '#e2e8f0',
                      color: active ? '#4f46e5' : '#64748b',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '0 22px 24px' }}>
          {/* ── INFO ── */}
          {tab === 'info' && (
            <div>
              <SectionTitle>Profil Pribadi</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                <InfoRow label="NISN">
                  <Typography.Text copyable={copyable(student.nisn)} style={{ fontSize: 14.5 }}>
                    {mask(student.nisn)}
                  </Typography.Text>
                </InfoRow>
                <InfoRow label="NIS">
                  <Typography.Text copyable={copyable(student.nis)} style={{ fontSize: 14.5 }}>
                    {mask(student.nis)}
                  </Typography.Text>
                </InfoRow>
                <InfoRow label="NIK">
                  <Typography.Text copyable={copyable(student.nik)} style={{ fontSize: 14.5 }}>
                    {mask(student.nik)}
                  </Typography.Text>
                </InfoRow>
                <InfoRow label="Jenis Kelamin">{student.gender ? GENDER_LABEL[student.gender] : '—'}</InfoRow>
                <InfoRow label="Agama">{student.religion ?? '—'}</InfoRow>
                <InfoRow label="Tempat, Tanggal Lahir">{ttl || '—'}</InfoRow>
                {student.status === 'lulus' && (
                  <InfoRow label="Tahun Lulus">
                    {student.graduation_year ?? '—'}
                    {student.last_class?.name ? ` · ${student.last_class.name}` : ''}
                  </InfoRow>
                )}
              </div>

              <SectionTitle
                extra={
                  student.phone && !isPrivacyMode ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <Button icon={<WhatsAppOutlined />} onClick={openWa} style={{ color: '#059669', borderColor: '#a7f3d0' }}>
                        Kirim WA
                      </Button>
                      <Button icon={<IdcardOutlined />} onClick={saveVcf}>
                        Simpan Kontak VCF
                      </Button>
                    </span>
                  ) : undefined
                }
              >
                Wali &amp; Kontak
              </SectionTitle>
              {student.guardian_name || student.phone ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                  <InfoRow label="Nama Wali">{mask(student.guardian_name)}</InfoRow>
                  <InfoRow label="Hubungan">{student.guardian_relation ?? '—'}</InfoRow>
                  <InfoRow label="No. HP / WhatsApp">
                    <Typography.Text copyable={copyable(student.phone)} style={{ fontSize: 14.5 }}>
                      {mask(student.phone)}
                    </Typography.Text>
                  </InfoRow>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 13.5 }}>Data wali belum tersedia</span>}>
                  {canEditData && (
                    <Button type="primary" onClick={goEdit}>
                      Lengkapi Data
                    </Button>
                  )}
                </Empty>
              )}

              <SectionTitle>Alamat &amp; Domisili</SectionTitle>
              {student.address || student.dorms?.name ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                  <InfoRow label="Alamat">{student.address ?? '—'}</InfoRow>
                  <InfoRow label="Asrama">{student.dorms?.name ?? 'Tanpa asrama'}</InfoRow>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 13.5 }}>Data alamat belum tersedia</span>}>
                  {canEditData && (
                    <Button type="primary" onClick={goEdit}>
                      Lengkapi Data
                    </Button>
                  )}
                </Empty>
              )}

              {tags.length > 0 && (
                <>
                  <SectionTitle>Info Khusus</SectionTitle>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.map((t) => (
                      <Tag key={t} style={{ borderRadius: 8, padding: '2px 10px' }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PERILAKU ── */}
          {tab === 'perilaku' &&
            (reportsQuery.isPending ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : reports.length === 0 ? (
              <TabEmpty title="Belum ada Kedisiplinan & Poin" description="Siswa ini belum memiliki catatan histori perilaku di sistem." />
            ) : (
              <div>
                <Card size="small" style={{ marginTop: 20, borderRadius: 13 }} styles={{ body: { padding: '12px 16px' } }}>
                  <Row gutter={12}>
                    <Col span={6}>
                      <Statistic title="Total Poin" value={points > 0 ? `+${points}` : points} valueStyle={{ color: points < 0 ? '#dc2626' : '#16a34a', fontSize: 22 }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="Total Log" value={reports.length} valueStyle={{ fontSize: 22 }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="Positif" value={posCount} valueStyle={{ color: '#16a34a', fontSize: 22 }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="Negatif" value={negCount} valueStyle={{ color: '#dc2626', fontSize: 22 }} />
                    </Col>
                  </Row>
                  <div style={{ height: 190, marginTop: 12, marginLeft: -8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#cbd5e1' }} allowDecimals={false} />
                        <RTooltip
                          cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                          formatter={(value, name) => [`${name === 'Positif' ? '+' : '-'}${value}`, name as string]}
                          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11.5, padding: '6px 10px' }}
                        />
                        <Bar dataKey="positif" name="Positif" stackId="p" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={26} />
                        <Bar dataKey="negatif" name="Negatif" stackId="p" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Segmented
                  block
                  size="small"
                  style={{ marginTop: 16 }}
                  value={pointFilter}
                  onChange={(v) => {
                    setPointFilter(v as 'all' | 'pos' | 'neg')
                    setVisibleLogs(8)
                  }}
                  options={[
                    { label: `Semua (${reports.length})`, value: 'all' },
                    { label: `Positif (${posCount})`, value: 'pos' },
                    { label: `Negatif (${negCount})`, value: 'neg' },
                  ]}
                />

                <Timeline
                  style={{ marginTop: 16 }}
                  items={filteredReports.map((r) => ({
                    color: r.points > 0 ? 'green' : r.points < 0 ? 'red' : 'gray',
                    children: (
                      <div style={{ paddingBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{r.rule?.name ?? '—'}</span>
                          <Tag
                            color={r.points > 0 ? 'green' : r.points < 0 ? 'red' : 'default'}
                            style={{ marginInlineEnd: 0, borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                          >
                            {r.points > 0 ? `+${r.points}` : r.points}
                          </Tag>
                        </div>
                        {r.notes && <div style={{ fontSize: 13, color: '#475569', marginTop: 2, overflowWrap: 'anywhere' }}>{r.notes}</div>}
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                          {dayjs(r.reported_at).format('DD MMM YYYY')} · {r.reporter?.name ?? 'Admin'}
                        </div>
                      </div>
                    ),
                  }))}
                />
                {filteredCount > visibleLogs && (
                  <Button type="dashed" block onClick={() => setVisibleLogs((v) => v + 8)} style={{ marginTop: 4 }}>
                    Muat Lagi ({filteredCount - visibleLogs} lagi)
                  </Button>
                )}
              </div>
            ))}

          {/* ── RAPORT ── */}
          {tab === 'raport' &&
            (raportQuery.isPending ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin />
              </div>
            ) : raportRows.length === 0 ? (
              <TabEmpty title="Arsip raport kosong" description="Data raport bulanan untuk siswa ini belum tersedia." />
            ) : (
              raportRows.map((r) => {
                const values = NILAI_KEYS.map((k) => r[k.key]).filter((v): v is number => v != null)
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
                        <span style={{ fontSize: 14.5 }}>Raport Bulanan {r.year}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: '#94a3b8' }}>{r.musyrif_name ?? ''}</span>
                      </span>
                    }
                    extra={
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5' }}>{avg ?? '—'}</span>
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8' }}>Rerata</span>
                      </span>
                    }
                  >
                    {NILAI_KEYS.map((k) => {
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
              <TabEmpty title="Belum ada aktivitas gerbang" description="Siswa ini belum memiliki catatan masuk/keluar di gerbang." />
            ) : (
              <List
                style={{ marginTop: 12 }}
                dataSource={gateLogs}
                renderItem={(g) => {
                  const keluar = g.direction === 'keluar'
                  return (
                    <List.Item style={{ padding: '10px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: keluar ? '#fff7ed' : '#ecfdf5',
                            color: keluar ? '#ea580c' : '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {keluar ? <LogoutOutlined /> : <LoginOutlined />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{dayjs(g.occurred_at).format('DD MMM YYYY · HH:mm')}</div>
                          {g.recorder?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{g.recorder.name}</div>}
                        </div>
                        <Tag color={keluar ? 'orange' : 'green'} style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                          {keluar ? 'Keluar' : 'Masuk'}
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
    </Drawer>
  )
}
