import { useMemo, useState } from 'react'
import { Button, Card, Checkbox, Empty, Space, Table, Typography, type TableColumnsType } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAcademicYearsBrief } from '../classes/hooks'
import { SetupBar } from './components/SetupBar'
import { ReportCard } from './components/ReportCard'
import {
  calcAverage,
  getCriteria,
  getPredicate,
  isComplete,
  MONTH_NAMES,
  REPORT_CARD_TYPE_LABEL,
} from './constants'
import {
  useMonthlyRows,
  useReportCardClasses,
  useReportCardStudents,
  useSchoolSettings,
  useSemesterRows,
} from './hooks'
import type { ReportCardStudent, ReportCardType, SemesterType } from './types'

export function PreviewPage() {
  const { classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [onlyComplete, setOnlyComplete] = useState(false)
  const [showRekap, setShowRekap] = useState(true)

  const typeRaw = searchParams.get('type') as ReportCardType | null
  const type: ReportCardType = typeRaw && typeRaw in REPORT_CARD_TYPE_LABEL ? typeRaw : 'monthly'
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ay = searchParams.get('ay') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useReportCardClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useReportCardStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isMonthly = type === 'monthly'
  const monthlyQuery = useMonthlyRows(studentIds, month, year)
  const semesterQuery = useSemesterRows(studentIds, type as SemesterType, semester, ay || undefined)
  const schoolQuery = useSchoolSettings()
  const yearsQuery = useAcademicYearsBrief()
  const yearName = (yearsQuery.data ?? []).find((y) => y.id === ay)?.name

  const monthlyById = useMemo(
    () => new Map((monthlyQuery.data ?? []).map((r) => [r.student_id, r])),
    [monthlyQuery.data],
  )
  const semesterById = useMemo(
    () => new Map((semesterQuery.data ?? []).map((r) => [r.student_id, r])),
    [semesterQuery.data],
  )

  // Fallback nama musyrif: param URL → data tersimpan → wali kelas
  const savedMusyrif =
    (isMonthly
      ? (monthlyQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name
      : (semesterQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name) ?? null

  const criteria = getCriteria(type, grade)
  const classNameLabel = classRow?.name ?? '—'

  const period = isMonthly
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : `Semester ${semester} — ${yearName ?? 'Tahun Ajaran'}`

  const reportNoFor = (student: ReportCardStudent) => {
    const no = students.findIndex((s) => s.id === student.id) + 1
    const periodShort = isMonthly
      ? `${MONTH_NAMES[month - 1].slice(0, 3).toUpperCase()}${year}`
      : `S${semester}`
    return `RPT/${classNameLabel}/${periodShort}/${no}`
  }

  const scoresFor = (studentId: string): Record<string, number | null> => {
    const out: Record<string, number | null> = {}
    for (const c of criteria) {
      if (isMonthly) {
        const row = monthlyById.get(studentId)
        out[c.key] = row
          ? ((row as unknown as Record<string, number | null>)[c.key] ?? null)
          : null
      } else {
        out[c.key] = semesterById.get(studentId)?.scores?.[c.key] ?? null
      }
    }
    return out
  }

  const visibleStudents = onlyComplete
    ? students.filter((s) => isComplete(type, scoresFor(s.id), grade))
    : students

  const rekapColumns: TableColumnsType<ReportCardStudent> = [
    { title: 'No', key: 'no', width: 50, render: (_: unknown, r: ReportCardStudent) => students.indexOf(r) + 1 },
    { title: 'Nama', key: 'name', render: (_, r) => r.name },
    ...criteria.map((c) => ({
      title: c.label,
      key: c.key,
      width: 86,
      render: (_: unknown, r: ReportCardStudent) => scoresFor(r.id)[c.key] ?? '—',
    })),
    {
      title: 'Rata-rata',
      key: 'avg',
      width: 90,
      render: (_: unknown, r: ReportCardStudent) => {
        const avg = calcAverage(type, scoresFor(r.id), grade)
        return <Typography.Text strong>{avg ?? '—'}</Typography.Text>
      },
    },
    {
      title: 'Predikat',
      key: 'pred',
      width: 130,
      render: (_: unknown, r: ReportCardStudent) => getPredicate(type, calcAverage(type, scoresFor(r.id), grade)),
    },
  ]

  const backSp = new URLSearchParams(searchParams)
  const backPath = `/report-cards/input/${classId}?${backSp.toString()}`

  return (
    <div>
      <PageHeader
        title="Preview & Cetak Raport"
        subtitle={classRow ? `Kelas ${classRow.name}` : '...'}
        extra={
          <Space wrap>
            <Link to={backPath}>
              <Button icon={<ArrowLeftOutlined />}>Kembali ke Input</Button>
            </Link>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
              Cetak {visibleStudents.length} Raport
            </Button>
          </Space>
        }
      />

      <SetupBar classId={classId} homeroomTeacherName={classRow?.homeroom_teacher?.name ?? null} />

      <Card style={{ marginBottom: 16 }} className="no-print">
        <Space wrap size="middle">
          <Checkbox checked={onlyComplete} onChange={(e) => setOnlyComplete(e.target.checked)}>
            Hanya raport lengkap
          </Checkbox>
          <Checkbox checked={showRekap} onChange={(e) => setShowRekap(e.target.checked)}>
            Tampilkan rekap nilai
          </Checkbox>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Gunakan dialog cetak browser untuk menyimpan sebagai PDF.
          </Typography.Text>
        </Space>
      </Card>

      {visibleStudents.length === 0 ? (
        <Card className="no-print">
          <Empty
            description={
              onlyComplete
                ? 'Belum ada raport lengkap — isi dulu nilai di halaman Input'
                : 'Belum ada data untuk periode ini'
            }
          />
        </Card>
      ) : (
        <>
          {showRekap && (
            <Card title="Rekap Nilai" size="small" className="no-print" style={{ marginBottom: 16 }}>
              <Table<ReportCardStudent>
                rowKey="id"
                size="small"
                columns={rekapColumns}
                dataSource={students}
                pagination={false}
                scroll={{ x: true }}
              />
            </Card>
          )}

          {/* Kontainer khusus cetak: hanya bagian ini yang tampil saat print */}
          <div className="report-card-print-root">
            {visibleStudents.map((student) => (
              <ReportCard
                key={student.id}
                type={type}
                grade={grade}
                student={student}
                classNameLabel={classNameLabel}
                period={period || `Semester ${semester}`}
                musyrifName={musyrif || savedMusyrif || classRow?.homeroom_teacher?.name || null}
                noUrut={students.indexOf(student) + 1}
                scores={scoresFor(student.id)}
                monthlyExtras={isMonthly ? monthlyById.get(student.id) ?? null : null}
                semesterExtras={isMonthly ? null : semesterById.get(student.id)?.extras ?? null}
                school={schoolQuery.data ?? null}
                reportNo={reportNoFor(student)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
