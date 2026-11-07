import { useMemo, useState } from 'react'
import { Button, Card, Checkbox, Empty, Space, Table, Typography, type TableColumnsType } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAcademicYearsBrief } from '../classes/hooks'
import { PeriodSetupBar } from './components/PeriodSetupBar'
import { RaportCard } from './components/RaportCard'
import {
  calcAverage,
  getCriteria,
  getPredicate,
  isComplete,
  MONTH_NAMES,
  RAPORT_TYPE_LABEL,
} from './constants'
import {
  useMonthlyRows,
  useRaportClasses,
  useRaportStudents,
  useSchoolSettings,
  useSemesterRows,
} from './hooks'
import type { RaportStudent, RaportType, SemesterType } from './types'

export function RaportPreviewPage() {
  const { classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [onlyComplete, setOnlyComplete] = useState(false)
  const [showRekap, setShowRekap] = useState(true)

  const jenisRaw = searchParams.get('jenis') as RaportType | null
  const jenis: RaportType = jenisRaw && jenisRaw in RAPORT_TYPE_LABEL ? jenisRaw : 'bulanan'
  const bulan = Number(searchParams.get('bulan')) || new Date().getMonth() + 1
  const tahun = Number(searchParams.get('tahun')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ta = searchParams.get('ta') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useRaportClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useRaportStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isBulanan = jenis === 'bulanan'
  const monthlyQuery = useMonthlyRows(studentIds, bulan, tahun)
  const semesterQuery = useSemesterRows(studentIds, jenis as SemesterType, semester, ta || undefined)
  const schoolQuery = useSchoolSettings()
  const yearsQuery = useAcademicYearsBrief()
  const yearName = (yearsQuery.data ?? []).find((y) => y.id === ta)?.name

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
    (isBulanan
      ? (monthlyQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name
      : (semesterQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name) ?? null

  const criteria = getCriteria(jenis, grade)
  const classNameLabel = classRow?.name ?? '—'

  const period = isBulanan
    ? `${MONTH_NAMES[bulan - 1]} ${tahun}`
    : `Semester ${semester} — ${yearName ?? 'Tahun Ajaran'}`

  const reportNoFor = (student: RaportStudent) => {
    const no = students.findIndex((s) => s.id === student.id) + 1
    const periodShort = isBulanan
      ? `${MONTH_NAMES[bulan - 1].slice(0, 3).toUpperCase()}${tahun}`
      : `S${semester}`
    return `RPT/${classNameLabel}/${periodShort}/${no}`
  }

  const scoresFor = (studentId: string): Record<string, number | null> => {
    const out: Record<string, number | null> = {}
    for (const c of criteria) {
      if (isBulanan) {
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
    ? students.filter((s) => isComplete(jenis, scoresFor(s.id), grade))
    : students

  const rekapColumns: TableColumnsType<RaportStudent> = [
    { title: 'No', key: 'no', width: 50, render: (_: unknown, r: RaportStudent) => students.indexOf(r) + 1 },
    { title: 'Nama', key: 'name', render: (_, r) => r.name },
    ...criteria.map((c) => ({
      title: c.label,
      key: c.key,
      width: 86,
      render: (_: unknown, r: RaportStudent) => scoresFor(r.id)[c.key] ?? '—',
    })),
    {
      title: 'Rata-rata',
      key: 'avg',
      width: 90,
      render: (_: unknown, r: RaportStudent) => {
        const avg = calcAverage(jenis, scoresFor(r.id), grade)
        return <Typography.Text strong>{avg ?? '—'}</Typography.Text>
      },
    },
    {
      title: 'Predikat',
      key: 'pred',
      width: 130,
      render: (_: unknown, r: RaportStudent) => getPredicate(jenis, calcAverage(jenis, scoresFor(r.id), grade)),
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

      <PeriodSetupBar classId={classId} homeroomTeacherName={classRow?.homeroom_teacher?.name ?? null} />

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
              <Table<RaportStudent>
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
          <div className="raport-print-root">
            {visibleStudents.map((student) => (
              <RaportCard
                key={student.id}
                type={jenis}
                grade={grade}
                student={student}
                classNameLabel={classNameLabel}
                period={period || `Semester ${semester}`}
                musyrifName={musyrif || savedMusyrif || classRow?.homeroom_teacher?.name || null}
                noUrut={students.indexOf(student) + 1}
                scores={scoresFor(student.id)}
                monthlyExtras={isBulanan ? monthlyById.get(student.id) ?? null : null}
                semesterExtras={isBulanan ? null : semesterById.get(student.id)?.extras ?? null}
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
