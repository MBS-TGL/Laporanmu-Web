import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  CopyOutlined,
  ClearOutlined,
  SaveOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { useReportCardClasses, useReportCardStudents } from '../report-cards/hooks'
import { useAttendanceRows, useSaveAttendance, useSyncAttendance } from './hooks'
import { countWeekdays, summarizeDays } from './api'
import type { AttendanceDays, AttendanceStatus } from './types'
import type { ReportCardStudent } from '../report-cards/types'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Urutan siklus saat sel diklik: '' → H → S → I → A → P → ''
const STATUS_CYCLE: (AttendanceStatus | '')[] = ['', 'H', 'S', 'I', 'A', 'P']

const STATUS_META: Record<AttendanceStatus, { label: string; color: string }> = {
  H: { label: 'Hadir', color: '#059669' },
  S: { label: 'Sakit', color: '#d97706' },
  I: { label: 'Izin', color: '#2563eb' },
  A: { label: 'Alpa', color: '#dc2626' },
  P: { label: 'Pulang Awal', color: '#7c3aed' },
}

const NEXT_STATUS: Record<string, AttendanceStatus | ''> = Object.fromEntries(
  STATUS_CYCLE.map((cur, i) => [cur, STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]]),
)

export function AttendancePage() {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const [classId, setClassId] = useState<string | undefined>(searchParams.get('class') ?? undefined)
  const [month, setMonth] = useState(Number(searchParams.get('month')) || now.getMonth() + 1)
  const [year, setYear] = useState(Number(searchParams.get('year')) || now.getFullYear())
  const [tab, setTab] = useState<'input' | 'rekap'>('input')

  // pilihan periode tersimpan di URL agar bisa di-deep-link (pola raport)
  const syncParams = (next: { class?: string; month?: number; year?: number }) => {
    const sp = new URLSearchParams()
    const klass = next.class ?? classId
    const b = next.month ?? month
    const t = next.year ?? year
    if (klass) sp.set('class', klass)
    sp.set('month', String(b))
    sp.set('year', String(t))
    setSearchParams(sp, { replace: true })
  }

  const studentsQuery = useReportCardStudents(classId)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const classesQuery = useReportCardClasses()

  const rowsQuery = useAttendanceRows(classId, year, month)
  const prevQuery = useAttendanceRows(classId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)

  const [drafts, setDrafts] = useState<Record<string, AttendanceDays>>({})
  const saveMutation = useSaveAttendance()
  const syncMutation = useSyncAttendance()

  const savedByStudent = useMemo(
    () => new Map((rowsQuery.data ?? []).map((r) => [r.student_id, r.days ?? {}])),
    [rowsQuery.data],
  )
  const prevByStudent = useMemo(
    () => new Map((prevQuery.data ?? []).map((r) => [r.student_id, r.days ?? {}])),
    [prevQuery.data],
  )

  const getDays = (studentId: string): AttendanceDays =>
    drafts[studentId] ?? savedByStudent.get(studentId) ?? {}

  const cycleCell = (studentId: string, day: number) => {
    if (!canWrite) return
    const current = getDays(studentId)[String(day)] ?? ''
    const next = NEXT_STATUS[current] ?? ''
    setDrafts((prev) => {
      const days = { ...(prev[studentId] ?? savedByStudent.get(studentId) ?? {}) }
      if (next === '') delete days[String(day)]
      else days[String(day)] = next
      return { ...prev, [studentId]: days }
    })
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const isWeekend = (d: number) => {
    const dow = new Date(year, month - 1, d).getDay()
    return dow === 0 || dow === 6
  }
  const weekdays = countWeekdays(year, month)

  const fillAll = (status: AttendanceStatus) => {
    if (!canWrite) return
    setDrafts(() => {
      const next: Record<string, AttendanceDays> = {}
      for (const s of students) {
        const days: AttendanceDays = { ...(drafts[s.id] ?? savedByStudent.get(s.id) ?? {}) }
        for (let d = 1; d <= daysInMonth; d++) {
          if (isWeekend(d)) continue
          days[String(d)] = status
        }
        next[s.id] = days
      }
      return next
    })
  }

  const resetGrid = () => setDrafts({})

  const copyLastMonth = () => {
    const prevRows = prevQuery.data ?? []
    if (prevRows.length === 0) {
      message.info(`Tidak ada data absensi ${MONTH_NAMES[month === 1 ? 12 : month - 1]} untuk disalin`)
      return
    }
    let copied = 0
    setDrafts((prev) => {
      const next = { ...prev }
      for (const row of prevRows) {
        if (Object.keys(next[row.student_id] ?? {}).length > 0) continue
        if (Object.keys(row.days ?? {}).length === 0) continue
        next[row.student_id] = { ...(row.days ?? {}) }
        copied += 1
      }
      return next
    })
    if (copied > 0) message.success(`Absensi bulan lalu disalin untuk ${copied} santri`)
    else message.info('Semua santri sudah memiliki absensi terisi')
  }

  const dirtyCount = Object.keys(drafts).length

  const handleSave = async () => {
    if (!classId || students.length === 0) return
    const { data: userData } = await supabase.auth.getUser()
    const payload = students.map((s) => ({
      student_id: s.id,
      class_id: classId,
      year: year,
      month: month,
      days: getDays(s.id),
      updated_by: userData.user?.id ?? null,
    }))
    saveMutation.mutate(payload, {
      onSuccess: () => {
        message.success(`Absensi ${MONTH_NAMES[month - 1]} ${year} tersimpan`)
        setDrafts({})
        void logAudit({
          action: 'UPDATE',
          source: 'OPERATIONAL',
          tableName: 'student_attendance',
          newData: { class_id: classId, year: year, month: month, students: payload.length },
        })
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan absensi'),
    })
  }

  const handleSync = () => {
    if (!classId) return
    const rows = students
      .map((s) => ({ student_id: s.id, days: getDays(s.id) }))
      .filter((r) => Object.keys(r.days).length > 0)
    if (rows.length === 0) {
      message.info('Belum ada absensi terisi untuk disinkronkan')
      return
    }
    syncMutation.mutate(
      { rows, classId, year: year, month: month, updatedBy: null },
      {
        onSuccess: async () => {
          const { data: userData } = await supabase.auth.getUser()
          void logAudit({
            action: 'SYNC',
            source: 'OPERATIONAL',
            tableName: 'student_monthly_reports',
            newData: { year: year, month: month, students: rows.length },
          })
          void userData
          message.success(`Rekap absensi tersinkron ke rapor ${MONTH_NAMES[month - 1]} (${rows.length} santri)`)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal sinkron ke rapor'),
      },
    )
  }

  const summaries = useMemo(
    () => new Map(students.map((s) => [s.id, summarizeDays(getDays(s.id))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, drafts, rowsQuery.data],
  )

  const rekapColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Santri',
      key: 'name',
      render: (_, s) => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.name}</div>
          <span style={{ fontSize: 12, color: '#888' }}>{s.registration_code}</span>
        </div>
      ),
    },
    ...(['H', 'S', 'I', 'A', 'P'] as AttendanceStatus[]).map((st) => ({
      title: STATUS_META[st].label,
      key: st,
      width: 82,
      render: (_: unknown, s: ReportCardStudent) => summaries.get(s.id)?.[st] ?? 0,
    })),
    {
      title: '% Hadir',
      key: 'pct',
      width: 150,
      render: (_: unknown, s: ReportCardStudent) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const pct = weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        const anyFilled = Object.keys(getDays(s.id)).length > 0
        const alert = sum.A >= 3 || (anyFilled && pct < 75)
        return (
          <Space size={8}>
            <Progress
              percent={pct}
              size="small"
              showInfo={false}
              style={{ width: 64, marginBottom: 0 }}
              strokeColor={alert ? '#ef4444' : pct >= 90 ? '#10b981' : '#6366f1'}
            />
            <Typography.Text style={{ fontSize: 12.5, color: alert ? '#dc2626' : undefined }}>
              {pct}%
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Δ Hadir',
      key: 'delta',
      width: 90,
      responsive: ['lg'],
      render: (_: unknown, s: ReportCardStudent) => {
        const prevSum = summarizeDays(prevByStudent.get(s.id) ?? {})
        const cur = summaries.get(s.id)?.H ?? 0
        const delta = cur - (prevSum.H ?? 0)
        if (Object.keys(prevByStudent.get(s.id) ?? {}).length === 0) return '-'
        return (
          <Typography.Text style={{ color: delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : undefined }}>
            {delta > 0 ? `+${delta}` : delta}
          </Typography.Text>
        )
      },
    },
    {
      title: 'Perhatian',
      key: 'alert',
      width: 150,
      responsive: ['md'],
      render: (_: unknown, s: ReportCardStudent) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const anyFilled = Object.keys(getDays(s.id)).length > 0
        const pct = weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        if (sum.A >= 3) return <Tag color="red">Alpa ≥ 3 hari</Tag>
        if (anyFilled && pct < 75) return <Tag color="orange">Hadir &lt; 75%</Tag>
        return <Tag color="green">Baik</Tag>
      },
    },
  ]

  const gridColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Nama Santri',
      key: 'name',
      fixed: 'left',
      width: 170,
      render: (_: unknown, s: ReportCardStudent) => (
        <Tooltip title={s.registration_code}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
        </Tooltip>
      ),
    },
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isWeekend(day) ? '#cbd5e1' : '#475569' }}>
            {day}
          </div>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][new Date(year, month - 1, day).getDay()]}
          </div>
        </div>
      ),
      key: `day-${day}`,
      width: 38,
      onHeaderCell: () => ({
        style: { padding: '4px 2px', background: isWeekend(day) ? '#f8fafc' : undefined },
      }),
      onCell: () => ({
        style: { padding: '2px', background: isWeekend(day) ? '#fbfcfe' : undefined },
      }),
      render: (_: unknown, s: ReportCardStudent) => {
        const status = getDays(s.id)[String(day)] ?? ''
        const meta = status ? STATUS_META[status] : null
        return (
          <Tooltip title={meta ? meta.label : `Klik isi hari ${day}`}>
            <div
              onClick={() => cycleCell(s.id, day)}
              style={{
                width: 28,
                height: 26,
                margin: '0 auto',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canWrite ? 'pointer' : 'default',
                fontSize: 12,
                fontWeight: 700,
                color: meta ? '#fff' : '#cbd5e1',
                background: meta ? meta.color : '#f1f5f9',
                userSelect: 'none',
              }}
            >
              {status || '·'}
            </div>
          </Tooltip>
        )
      },
    })),
    {
      title: 'H',
      key: 'sum-h',
      width: 44,
      render: (_: unknown, s: ReportCardStudent) => (
        <Typography.Text strong style={{ fontSize: 12.5 }}>
          {summaries.get(s.id)?.H ?? 0}
        </Typography.Text>
      ),
    },
  ]

  const totalHadir = students.reduce((acc, s) => acc + (summaries.get(s.id)?.H ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Absensi Santri"
        subtitle="Kehadiran harian per kelas per bulan — klik sel untuk mengubah status"
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Select
            placeholder="Pilih kelas"
            style={{ minWidth: 180 }}
            value={classId}
            onChange={(v) => {
              setClassId(v as string)
              setDrafts({})
              syncParams({ class: v as string })
            }}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            style={{ minWidth: 130 }}
            value={month}
            onChange={(v) => {
              setMonth(v as number)
              setDrafts({})
              syncParams({ month: v as number })
            }}
            options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Select
            style={{ minWidth: 100 }}
            value={year}
            onChange={(v) => {
              setYear(v as number)
              setDrafts({})
              syncParams({ year: v as number })
            }}
            options={[year - 1, year, year + 1].map((y) => ({ value: y, label: String(y) }))}
          />
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as 'input' | 'rekap')}
            options={[
              { label: 'Input', value: 'input' },
              { label: 'Rekap', value: 'rekap' },
            ]}
          />
        </Space>
      </Card>

      {!classId ? (
        <Card>
          <Empty description="Pilih kelas untuk mulai mengisi absensi" />
        </Card>
      ) : (
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'input' | 'rekap')}
          items={[
            {
              key: 'input',
              label: 'Grid Absensi',
              children: (
                <Card>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Space wrap size="small">
                      <Button
                        icon={<ThunderboltOutlined />}
                        onClick={() => fillAll('H')}
                        disabled={!canWrite}
                      >
                        Isi Semua Hadir
                      </Button>
                      <Button icon={<CopyOutlined />} onClick={copyLastMonth} disabled={!canWrite}>
                        Salin Bulan Lalu
                      </Button>
                      <Button icon={<ClearOutlined />} onClick={resetGrid} disabled={!canWrite}>
                        Reset Grid
                      </Button>
                      <Tooltip title="Salin rekap Sakit/Izin/Alpa/Pulang ke rapor bulanan">
                        <Button
                          icon={<SyncOutlined />}
                          onClick={handleSync}
                          loading={syncMutation.isPending}
                          disabled={!canWrite}
                        >
                          Sinkron ke Rapor
                        </Button>
                      </Tooltip>
                    </Space>
                    <Space size="middle">
                      {dirtyCount > 0 && <Tag color="processing">{dirtyCount} draf belum disimpan</Tag>}
                      {canWrite && (
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          onClick={() => void handleSave()}
                          loading={saveMutation.isPending}
                        >
                          Simpan Absensi
                        </Button>
                      )}
                    </Space>
                  </div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Klik sel untuk siklus: Kosong → Hadir → Sakit → Izin → Alpa → Pulang Awal. Hari kerja bulan ini: ${weekdays} hari.`}
                  />
                  <Table<ReportCardStudent>
                    rowKey="id"
                    columns={gridColumns}
                    dataSource={students}
                    loading={studentsQuery.isLoading || rowsQuery.isLoading}
                    locale={{
                      emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kelas ini belum punya siswa" />,
                    }}
                    pagination={false}
                    scroll={{ x: `max-content` }}
                    size="small"
                  />
                </Card>
              ),
            },
            {
              key: 'rekap',
              label: 'Rekap',
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={12} sm={8} xl={6}>
                      <Card>
                        <Statistic title="Santri" value={students.length} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} xl={6}>
                      <Card>
                        <Statistic title="Total Hadir" value={totalHadir} />
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} xl={6}>
                      <Card>
                        <Statistic
                          title="Hari Kerja"
                          value={weekdays}
                          suffix={`/ ${daysInMonth} hari`}
                        />
                      </Card>
                    </Col>
                  </Row>
                  <Card>
                    <Table<ReportCardStudent>
                      rowKey="id"
                      columns={rekapColumns}
                      dataSource={students}
                      loading={studentsQuery.isLoading || rowsQuery.isLoading}
                      pagination={false}
                      scroll={{ x: true }}
                    />
                  </Card>
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}

