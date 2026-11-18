import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  BellOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchSubjectAttendance,
  fetchSubjectAttendanceRange,
  fetchSubjectSlots,
  upsertSubjectAttendance,
  type SubjectAttendanceEntry,
  type SubjectSlot,
} from './api'
import { earlyWarning, heatmapBySubject, weeklyTrend, type SubjectHeatRow } from './subjectsAnalytics'
import { fetchAbsentContacts, maybeSendAbsentWa } from './waAuto'
import { useReportCardClasses, useReportCardStudents } from '../report-cards/hooks'
import { usePermissions, useProfile } from '../../shared/hooks/useProfile'
import { STATUS_META } from './constants'

const SUBJECT_STATUSES = ['H', 'S', 'I', 'A'] as const
type SubjectStatus = (typeof SUBJECT_STATUSES)[number]

const cellKey = (studentId: string, scheduleId: string) => `${studentId}:${scheduleId}`

interface StudentBrief {
  id: string
  name: string
}

/** Tab Absensi Mapel (P2): grid santri × jam pelajaran kelas pada satu tanggal,
 *  isi cepat, simpan (upsert), WA wali untuk alpa, dan analitik bulan berjalan. */
export function SubjectsTab({ active = true }: { active?: boolean }) {
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState<Dayjs>(dayjs())
  const dateStr = date.format('YYYY-MM-DD')

  const classesQuery = useReportCardClasses()
  const studentsQuery = useReportCardStudents(classId)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])

  const slotsQuery = useQuery({
    queryKey: ['subject-slots', classId, dateStr],
    queryFn: () => fetchSubjectSlots(classId!, dateStr),
    enabled: Boolean(classId),
    staleTime: 60_000,
  })
  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data])

  const existingQuery = useQuery({
    queryKey: ['subject-attendance', 'day', classId, dateStr],
    queryFn: () => fetchSubjectAttendance(slots.map((s) => s.schedule_id), dateStr),
    enabled: Boolean(classId) && slots.length > 0,
  })
  const existing = existingQuery.data ?? []

  if (!active) return null

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap size={10} align="center">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih kelas"
            style={{ minWidth: 200 }}
            value={classId}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            onChange={setClassId}
            aria-label="Pilih kelas"
          />
          <DatePicker
            value={date}
            onChange={(v) => v && setDate(v)}
            allowClear={false}
            aria-label="Pilih tanggal"
          />
        </Space>
      </Card>

      {!classId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas untuk melihat grid absensi mapel" />
        </Card>
      ) : slotsQuery.isPending || existingQuery.isPending ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        </Card>
      ) : slots.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`Tidak ada jadwal ${dayjs(dateStr).format('dddd, DD MMM YYYY')} untuk kelas ini. Isi jadwal KBM di menu Jadwal.`}
          />
        </Card>
      ) : (
        // Key menyertakan data ter-simpan: ganti kelas/tanggal/data → remount
        // dan draf dihidrasi dari server via useState initializer (tanpa effect)
        <GridCard
          key={`${classId}:${dateStr}:${existing.length}:${existingQuery.dataUpdatedAt}`}
          slots={slots}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
          existing={existing}
          dateStr={dateStr}
        />
      )}

      {classId && slots.length > 0 && (
        <AnalyticsSection classId={classId} students={students.map((s) => ({ id: s.id, name: s.name }))} />
      )}
    </div>
  )
}

function GridCard({
  slots,
  students,
  existing,
  dateStr,
}: {
  slots: SubjectSlot[]
  students: StudentBrief[]
  existing: SubjectAttendanceEntry[]
  dateStr: string
}) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const { profile } = useProfile()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  // Draf = peta sel → status. Hidrasi awal dari data server (initializer).
  const buildDrafts = () => {
    const map = new Map<string, SubjectStatus>()
    for (const r of existing) map.set(cellKey(r.student_id, r.schedule_id), r.status)
    return map
  }
  const [drafts, setDrafts] = useState<Map<string, SubjectStatus>>(buildDrafts)
  const [dirty, setDirty] = useState(false)

  const cycle = (key: string, current: SubjectStatus | undefined) => {
    setDirty(true)
    setDrafts((prev) => {
      const next = new Map(prev)
      const idx = current ? SUBJECT_STATUSES.indexOf(current) : -1
      next.set(key, SUBJECT_STATUSES[(idx + 1) % SUBJECT_STATUSES.length])
      return next
    })
  }

  const fillAllPresent = () => {
    setDirty(true)
    setDrafts((prev) => {
      const next = new Map(prev)
      for (const s of students) {
        for (const slot of slots) {
          next.set(cellKey(s.id, slot.schedule_id), 'H')
        }
      }
      return next
    })
  }

  const undoDrafts = () => {
    setDrafts(buildDrafts())
    setDirty(false)
  }

  const save = async () => {
    if (slots.length === 0 || !canWrite) return
    setSaving(true)
    try {
      const serverMap = new Map(existing.map((r) => [cellKey(r.student_id, r.schedule_id), r.status]))
      const payload = [...drafts.entries()]
        .filter(([key, status]) => serverMap.get(key) !== status)
        .map(([key, status]) => {
          const [studentId, scheduleId] = key.split(':')
          return { student_id: studentId, schedule_id: scheduleId, date: dateStr, status, recorded_by: profile?.id ?? null }
        })
      if (payload.length === 0) {
        message.info('Tidak ada perubahan untuk disimpan')
        return
      }
      await upsertSubjectAttendance(payload)

      // WA wali untuk santri alpa (fire-and-forget, debounce harian)
      const alpaByStudent = new Map<string, SubjectSlot>()
      for (const [key, status] of drafts.entries()) {
        if (status !== 'A') continue
        const [studentId, scheduleId] = key.split(':')
        if (!alpaByStudent.has(studentId)) {
          const slot = slots.find((s) => s.schedule_id === scheduleId)
          if (slot) alpaByStudent.set(studentId, slot)
        }
      }
      if (alpaByStudent.size > 0) {
        const contacts = await fetchAbsentContacts([...alpaByStudent.keys()])
        void maybeSendAbsentWa(
          dateStr,
          [...alpaByStudent.entries()].map(([studentId, slot]) => {
            const c = contacts.get(studentId)
            return {
              studentId,
              name: c?.name ?? '',
              className: c?.className ?? '',
              guardianName: c?.guardianName ?? null,
              phone: c?.phone ?? null,
              slot: {
                jam: `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`,
                mapel: slot.subject ?? 'jam pelajaran',
              },
            }
          }),
        )
      }

      await qc.invalidateQueries({ queryKey: ['subject-attendance'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDirty(false)
      message.success(`Absensi ${payload.length} sel tersimpan`)
    } catch (err) {
      message.error((err as Error).message || 'Gagal menyimpan absensi')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Santri',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 180,
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    ...slots.map((slot, idx) => ({
      title: (
        <Tooltip title={`${slot.subject ?? '-'} · ${slot.teacher ?? 'tanpa guru'}${slot.room ? ` · ${slot.room}` : ''}`}>
          <div style={{ textAlign: 'center', minWidth: 56 }}>
            <div style={{ fontWeight: 700, fontSize: 11 }}>J{idx + 1}</div>
            <div style={{ fontSize: 10, color: token.colorTextTertiary }}>{slot.start_time.slice(0, 5)}</div>
          </div>
        </Tooltip>
      ),
      key: slot.schedule_id,
      width: 72,
      render: (_: unknown, row: StudentBrief) => {
        const status = drafts.get(cellKey(row.id, slot.schedule_id))
        const meta = status ? STATUS_META[status] : null
        return (
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => cycle(cellKey(row.id, slot.schedule_id), status)}
            aria-label={`${row.name} jam ${idx + 1}: ${meta?.label ?? 'kosong'}`}
            style={{
              width: 44,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${meta ? meta.color : token.colorBorderSecondary}`,
              background: meta ? `${meta.color}1a` : 'transparent',
              color: meta ? meta.color : token.colorTextTertiary,
              fontWeight: 700,
              fontSize: 12,
              cursor: canWrite ? 'pointer' : 'not-allowed',
            }}
          >
            {status ?? ''}
          </button>
        )
      },
    })),
  ]

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>Grid Absensi Mapel</span>
        </Space>
      }
      extra={
        <Space size={8}>
          <Tooltip title="Tandai semua sel Hadir">
            <Button icon={<CheckSquareOutlined />} disabled={!canWrite} onClick={fillAllPresent}>
              Hadir Semua
            </Button>
          </Tooltip>
          <Tooltip title="Kembalikan ke data tersimpan">
            <Button icon={<UndoOutlined />} disabled={!dirty} onClick={undoDrafts}>
              Batal Ubah
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!dirty || !canWrite}
            onClick={() => void save()}
          >
            Simpan
          </Button>
        </Space>
      }
      styles={{ body: { padding: '8px 12px' } }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="Klik sel untuk mengganti: Hadir → Sakit → Izin → Alpa → Hadir. Guru per jam diambil dari jadwal (termasuk guru pengganti)."
      />
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={students}
        pagination={false}
        scroll={{ x: 180 + slots.length * 72, y: 420 }}
        sticky
      />
    </Card>
  )
}

function AnalyticsSection({
  classId,
  students,
}: {
  classId: string
  students: StudentBrief[]
}) {
  const { token } = theme.useToken()
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
  const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD')

  const rangeQuery = useQuery({
    queryKey: ['subject-attendance', 'range', classId, monthStart],
    queryFn: () => fetchSubjectAttendanceRange(classId, monthStart, monthEnd),
    enabled: Boolean(classId),
    staleTime: 60_000,
  })
  const entries: SubjectAttendanceEntry[] = rangeQuery.data ?? []

  const trend = useMemo(() => weeklyTrend(entries), [entries])
  const heat = useMemo(() => heatmapBySubject(entries), [entries])
  const watchlist = useMemo(() => earlyWarning(entries, 3), [entries])
  const nameById = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students])

  return (
    <Card
      title={
        <Space>
          <BellOutlined />
          <span>Analitik Absensi Mapel · {dayjs().format('MMMM YYYY')}</span>
        </Space>
      }
      styles={{ body: { padding: '12px 16px' } }}
    >
      {rangeQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : entries.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada data absensi mapel bulan ini untuk kelas ini"
        />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              Tren Mingguan (% Hadir)
            </Typography.Text>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {trend.map((t) => (
                <div key={t.weekStart} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text style={{ fontSize: 11.5, width: 92, color: token.colorTextSecondary }}>
                    {dayjs(t.weekStart).format('DD MMM')}
                  </Typography.Text>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: token.colorFillSecondary }}>
                    <div
                      style={{
                        width: `${t.pct}%`,
                        height: '100%',
                        borderRadius: 4,
                        background: t.pct >= 90 ? '#10b981' : t.pct >= 75 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <Typography.Text
                    style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', width: 64, textAlign: 'right' }}
                  >
                    {t.pct}% ({t.hadir}/{t.total})
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Col>
          <Col xs={24} lg={9}>
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              Per Mapel
            </Typography.Text>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {heat.map((h: SubjectHeatRow) => (
                <div key={h.subject} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text style={{ fontSize: 12, flex: 1, minWidth: 0 }} ellipsis>
                    {h.subject}
                  </Typography.Text>
                  <Space size={4} wrap>
                    <Tag style={{ borderRadius: 999 }}>H {h.hadir}</Tag>
                    {h.sakit > 0 && <Tag color="gold" style={{ borderRadius: 999 }}>S {h.sakit}</Tag>}
                    {h.izin > 0 && <Tag color="blue" style={{ borderRadius: 999 }}>I {h.izin}</Tag>}
                    {h.alpa > 0 && <Tag color="error" style={{ borderRadius: 999 }}>A {h.alpa}</Tag>}
                    <Tag
                      color={h.pct >= 90 ? 'success' : h.pct >= 75 ? 'warning' : 'error'}
                      style={{ borderRadius: 999 }}
                    >
                      {h.pct}%
                    </Tag>
                  </Space>
                </div>
              ))}
            </div>
          </Col>
          <Col xs={24} lg={7}>
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              Peringatan Dini (alpa ≥ 3 / bulan)
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {watchlist.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Tidak ada santri pada ambang peringatan.
                </Typography.Text>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {watchlist.map((w) => (
                    <Tag key={w.studentId} color="error" style={{ borderRadius: 999 }}>
                      {nameById.get(w.studentId) ?? 'Santri'} · alpa {w.alpa}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </Col>
        </Row>
      )}
    </Card>
  )
}
