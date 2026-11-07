import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Progress, Row, Select, Tabs, Typography } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import {
  BULANAN_CRITERIA,
  MONTH_NAMES,
  RAPORT_TYPE_LABEL,
  isComplete,
} from './constants'
import { useAllMonthlyRows, useAllSemesterRows, useAllStudentClasses, useRaportClasses } from './hooks'
import type { RaportType, SemesterType } from './types'

function ClassGrid({
  loading,
  items,
  onOpen,
}: {
  loading: boolean
  items: { id: string; name: string; musyrif: string | null; total: number; complete: number }[]
  onOpen: (classId: string) => void
}) {
  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3].map((i) => (
          <Col key={i} xs={24} sm={12} lg={8}>
            <Card loading />
          </Col>
        ))}
      </Row>
    )
  }
  if (items.length === 0) {
    return <Empty description="Belum ada kelas aktif — tambahkan dulu di Master Data" />
  }
  return (
    <Row gutter={[16, 16]}>
      {items.map((item) => {
        const pct = item.total > 0 ? Math.round((item.complete / item.total) * 100) : 0
        return (
          <Col key={item.id} xs={24} sm={12} lg={8}>
            <Card
              styles={{ body: { padding: '16px 18px' } }}
              actions={[
                <Button
                  key="input"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => onOpen(item.id)}
                >
                  Input Nilai
                </Button>,
              ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {item.name}
                  </Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 0' }}>
                    {item.musyrif ?? 'Tanpa wali kelas'} · {item.total} siswa
                  </Typography.Paragraph>
                </div>
                <Typography.Text strong style={{ fontSize: 18, color: pct === 100 ? '#16a34a' : undefined }}>
                  {item.complete}/{item.total}
                </Typography.Text>
              </div>
              <Progress
                percent={pct}
                size="small"
                strokeColor={pct === 100 ? '#10b981' : pct > 0 ? '#6366f1' : '#e2e8f0'}
                style={{ marginTop: 10, marginBottom: 0 }}
              />
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

export function RaportPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [semesterType, setSemesterType] = useState<SemesterType>('umum')
  const [semester, setSemester] = useState<1 | 2>(1)

  const classesQuery = useRaportClasses()
  const studentClassesQuery = useAllStudentClasses()
  const monthlyQuery = useAllMonthlyRows()
  const semesterQuery = useAllSemesterRows(semesterType)

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const studentClassMap = useMemo(
    () => new Map((studentClassesQuery.data ?? []).map((s) => [s.id, s.class_id])),
    [studentClassesQuery.data],
  )
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])

  const monthlyItems = useMemo(() => {
    const buckets = new Map<string, { complete: number; filled: number }>()
    for (const row of monthlyQuery.data ?? []) {
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const key = classId
      const bucket = buckets.get(key) ?? { complete: 0, filled: 0 }
      const values = [row.nilai_akhlak, row.nilai_ibadah, row.nilai_kebersihan, row.nilai_quran, row.nilai_bahasa]
      const isFull = values.every((v) => typeof v === 'number')
      if (isFull) bucket.complete += 1
      if (values.some((v) => typeof v === 'number')) bucket.filled += 1
      buckets.set(key, bucket)
    }
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      musyrif: c.homeroom_teacher?.name ?? null,
      total: (studentClassesQuery.data ?? []).filter((s) => s.class_id === c.id).length,
      complete: buckets.get(c.id)?.complete ?? 0,
      filled: buckets.get(c.id)?.filled ?? 0,
    }))
  }, [monthlyQuery.data, studentClassMap, classes, studentClassesQuery.data])

  const semesterItems = useMemo(() => {
    const taId = classes[0]?.academic_year_id ?? ''
    const buckets = new Map<string, number>()
    for (const row of semesterQuery.data ?? []) {
      if (row.semester !== semester) continue
      if (row.academic_year_id !== taId) continue
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const grade = classById.get(classId)?.grade ?? null
      const complete = isComplete(semesterType, row.scores ?? {}, grade)
      if (complete) buckets.set(classId, (buckets.get(classId) ?? 0) + 1)
    }
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      musyrif: c.homeroom_teacher?.name ?? null,
      total: (studentClassesQuery.data ?? []).filter((s) => s.class_id === c.id).length,
      complete: buckets.get(c.id) ?? 0,
      filled: (semesterQuery.data ?? []).filter((row) => {
        const classId = studentClassMap.get(row.student_id)
        return (
          row.semester === semester &&
          row.academic_year_id === (c.academic_year_id ?? '') &&
          classId === c.id &&
          Object.values(row.scores ?? {}).some((v) => typeof v === 'number')
        )
      }).length,
    }))
  }, [semesterQuery.data, studentClassMap, classes, classById, semester, semesterType, studentClassesQuery.data])

  const openMonthly = (classId: string) => {
    navigate(`/report-cards/input/${classId}?jenis=bulanan&bulan=${bulan}&tahun=${tahun}`)
  }

  const openSemester = (classId: string) => {
    const ta = classes.find((c) => c.id === classId)?.academic_year_id
    const sp = new URLSearchParams({
      jenis: semesterType,
      semester: String(semester),
    })
    if (ta) sp.set('ta', ta)
    navigate(`/report-cards/input/${classId}?${sp.toString()}`)
  }

  const semesterTaLabel = classes[0]?.academic_year_id
    ? 'tahun ajaran pada kelas terkait'
    : 'tahun ajaran'

  return (
    <div>
      <PageHeader
        title="Raport"
        subtitle="Kelola raport bulanan pondok dan raport semester"
      />

      <Tabs
        defaultActiveKey="bulanan"
        items={[
          {
            key: 'bulanan',
            label: 'Raport Bulanan',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography.Text strong>Periode:</Typography.Text>
                    <Select
                      style={{ minWidth: 140 }}
                      value={bulan}
                      onChange={setBulan}
                      options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
                    />
                    <Select
                      style={{ minWidth: 110 }}
                      value={tahun}
                      onChange={setTahun}
                      options={[tahun - 1, tahun, tahun + 1].map((y) => ({ value: y, label: String(y) }))}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                      Skala nilai 1–9 · {BULANAN_CRITERIA.length} kriteria
                    </Typography.Text>
                  </div>
                </Card>
                <ClassGrid
                  loading={classesQuery.isPending || monthlyQuery.isPending}
                  items={monthlyItems}
                  onOpen={openMonthly}
                />
              </>
            ),
          },
          {
            key: 'semester',
            label: 'Raport Semester',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography.Text strong>Jenis:</Typography.Text>
                    <Select
                      style={{ minWidth: 170 }}
                      value={semesterType}
                      onChange={(v) => setSemesterType(v as SemesterType)}
                      options={(Object.entries(RAPORT_TYPE_LABEL) as [RaportType, string][])
                        .filter(([k]) => k !== 'bulanan')
                        .map(([value, label]) => ({ value, label }))}
                    />
                    <Typography.Text strong>Semester:</Typography.Text>
                    <Select
                      style={{ minWidth: 170 }}
                      value={semester}
                      onChange={(v) => setSemester(v as 1 | 2)}
                      options={[
                        { value: 1, label: 'Semester 1 (Ganjil)' },
                        { value: 2, label: 'Semester 2 (Genap)' },
                      ]}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                      Skala 0–100 (KKM 50) · {semesterTaLabel}
                    </Typography.Text>
                  </div>
                </Card>
                <ClassGrid
                  loading={classesQuery.isPending || semesterQuery.isPending}
                  items={semesterItems}
                  onOpen={openSemester}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  )
}

export type { RaportType }
