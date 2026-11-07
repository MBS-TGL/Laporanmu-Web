import { useMemo, useState } from 'react'
import { Button, Card, Empty, Popconfirm, Progress, Select, Space, Table, Tabs, Typography, type TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions } from '../../shared/hooks/useProfile'
import { isComplete, MONTH_NAMES, RAPORT_TYPE_LABEL } from './constants'
import {
  useAllMonthlyRows,
  useAllSemesterRows,
  useAllStudentClasses,
  useRaportClasses,
  useResetMonthlyPeriod,
  useResetSemesterPeriod,
} from './hooks'
import type { RaportType, SemesterType } from './types'

interface ArchiveBucket {
  key: string
  classId: string
  className: string
  periodLabel: string
  musyrif: string | null
  filled: number
  complete: number
  total: number
  navigateParams: string
  monthlyReset?: { studentIds: string[]; month: number; year: number }
  semesterReset?: {
    studentIds: string[]
    reportType: SemesterType
    semester: 1 | 2
    academicYearId: string
  }
}

export function RaportArchivePage() {
  const navigate = useNavigate()
  const { canDelete } = usePermissions()
  const [semesterType, setSemesterType] = useState<SemesterType>('umum')

  const classesQuery = useRaportClasses()
  const studentClassesQuery = useAllStudentClasses()
  const monthlyQuery = useAllMonthlyRows()
  const semesterQuery = useAllSemesterRows(semesterType)
  const resetMonthly = useResetMonthlyPeriod()
  const resetSemester = useResetSemesterPeriod()

  const classById = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c])),
    [classesQuery.data],
  )
  const studentClassMap = useMemo(
    () => new Map((studentClassesQuery.data ?? []).map((s) => [s.id, s.class_id])),
    [studentClassesQuery.data],
  )
  const classTotal = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of studentClassesQuery.data ?? []) {
      if (!s.class_id) continue
      counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1)
    }
    return counts
  }, [studentClassesQuery.data])

  const monthlyBuckets = useMemo<ArchiveBucket[]>(() => {
    const monthlyRows = monthlyQuery.data ?? []
    const map = new Map<string, { rows: typeof monthlyRows; classId: string; year: number; month: number }>()
    for (const row of monthlyRows) {
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const key = `${classId}__${row.year}__${row.month}`
      const bucket = map.get(key) ?? { rows: [] as typeof monthlyRows, classId, year: row.year, month: row.month }
      bucket.rows.push(row)
      map.set(key, bucket)
    }
    return [...map.entries()]
      .map(([key, b]) => {
        const complete = b.rows.filter((r) =>
          [r.nilai_akhlak, r.nilai_ibadah, r.nilai_kebersihan, r.nilai_quran, r.nilai_bahasa].every(
            (v) => typeof v === 'number',
          ),
        ).length
        const sp = new URLSearchParams({ jenis: 'bulanan', bulan: String(b.month), tahun: String(b.year) })
        return {
          key,
          classId: b.classId,
          className: classById.get(b.classId)?.name ?? '—',
          periodLabel: `${MONTH_NAMES[b.month - 1]} ${b.year}`,
          musyrif: b.rows.find((r) => r.musyrif_name)?.musyrif_name ?? null,
          filled: b.rows.length,
          complete,
          total: classTotal.get(b.classId) ?? 0,
          navigateParams: sp.toString(),
          monthlyReset: { studentIds: b.rows.map((r) => r.student_id), month: b.month, year: b.year },
        }
      })
      .sort((a, b) => b.periodLabel.localeCompare(a.periodLabel) || a.className.localeCompare(b.className))
  }, [monthlyQuery.data, studentClassMap, classById, classTotal])

  const semesterBuckets = useMemo<ArchiveBucket[]>(() => {
    const semesterRows = semesterQuery.data ?? []
    const map = new Map<
      string,
      { rows: typeof semesterRows; classId: string; semester: 1 | 2; taId: string }
    >()
    for (const row of semesterRows) {
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const key = `${classId}__${row.semester}__${row.academic_year_id}`
      const bucket =
        map.get(key) ??
        { rows: [] as typeof semesterRows, classId, semester: row.semester, taId: row.academic_year_id }
      bucket.rows.push(row)
      map.set(key, bucket)
    }
    return [...map.entries()].map(([key, b]) => {
      const grade = classById.get(b.classId)?.grade ?? null
      const complete = b.rows.filter((r) => isComplete(semesterType, r.scores ?? {}, grade)).length
      const sp = new URLSearchParams({ jenis: semesterType, semester: String(b.semester), ta: b.taId })
      return {
        key,
        classId: b.classId,
        className: classById.get(b.classId)?.name ?? '—',
        periodLabel: `Semester ${b.semester} — ${b.taId.slice(0, 8)}…`,
        musyrif: b.rows.find((r) => r.musyrif_name)?.musyrif_name ?? null,
        filled: b.rows.length,
        complete,
        total: classTotal.get(b.classId) ?? 0,
        navigateParams: sp.toString(),
        semesterReset: {
          studentIds: b.rows.map((r) => r.student_id),
          reportType: semesterType,
          semester: b.semester,
          academicYearId: b.taId,
        },
      }
    })
  }, [semesterQuery.data, studentClassMap, classById, classTotal, semesterType])

  const columns: TableColumnsType<ArchiveBucket> = [
    { title: 'Kelas', dataIndex: 'className', key: 'className', render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Periode', dataIndex: 'periodLabel', key: 'periodLabel' },
    { title: 'Musyrif', key: 'musyrif', render: (_, r) => r.musyrif ?? '-', responsive: ['md'] },
    {
      title: 'Lengkap',
      key: 'pct',
      width: 200,
      render: (_, r) => {
        const pct = r.total > 0 ? Math.round((r.complete / r.total) * 100) : 0
        return (
          <Space size={10}>
            <Progress percent={pct} size="small" style={{ width: 90, marginBottom: 0 }} showInfo={false} />
            <Typography.Text style={{ fontSize: 12.5 }}>
              {r.complete}/{r.total}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/report-cards/input/${r.classId}?${r.navigateParams}`)}
          />
          <Button
            type="text"
            icon={<PrinterOutlined />}
            onClick={() => navigate(`/report-cards/preview/${r.classId}?${r.navigateParams}`)}
          />
          {canDelete && (
            <Popconfirm
              title="Hapus seluruh arsip periode ini?"
              description={`${r.filled} baris raport akan dihapus permanen.`}
              onConfirm={() => {
                if (r.monthlyReset) resetMonthly.mutate(r.monthlyReset)
                else if (r.semesterReset) resetSemester.mutate(r.semesterReset)
              }}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Arsip Raport" subtitle="Riwayat raport per kelas dan periode" />

      <Tabs
        defaultActiveKey="bulanan"
        items={[
          {
            key: 'bulanan',
            label: 'Bulanan',
            children: (
              <Card>
                <Table<ArchiveBucket>
                  rowKey="key"
                  columns={columns}
                  dataSource={monthlyBuckets}
                  loading={monthlyQuery.isPending || studentClassesQuery.isPending}
                  locale={{
                    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada arsip raport bulanan" />,
                  }}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
          {
            key: 'semester',
            label: 'Semester',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Typography.Text strong>Jenis:</Typography.Text>
                    <Select
                      style={{ minWidth: 170 }}
                      value={semesterType}
                      onChange={(v) => setSemesterType(v as SemesterType)}
                      options={(Object.entries(RAPORT_TYPE_LABEL) as [RaportType, string][])
                        .filter(([k]) => k !== 'bulanan')
                        .map(([value, label]) => ({ value, label }))}
                    />
                  </Space>
                </Card>
                <Card>
                  <Table<ArchiveBucket>
                    rowKey="key"
                    columns={columns}
                    dataSource={semesterBuckets}
                    loading={semesterQuery.isPending || studentClassesQuery.isPending}
                    locale={{
                      emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada arsip raport semester" />,
                    }}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
